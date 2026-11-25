"""Route, API, and content-integrity tests for fivebigthings.app.

These guard the promises the app makes: every page route answers, the daily
round can never be served from a cache, the service worker is root-scoped,
and the question calendar is complete and gap-free.
"""
import json
import sys
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

import app as app_module  # noqa: E402

app = app_module.app

client = app.test_client()


def test_pages_return_200():
    for path in ["/", "/junior", "/globe", "/offline.html"]:
        resp = client.get(path)
        assert resp.status_code == 200, path
        assert b"</html>" in resp.data, path


def test_service_worker_is_root_scoped_and_uncached():
    resp = client.get("/sw.js")
    assert resp.status_code == 200
    assert resp.headers.get("Service-Worker-Allowed") == "/"
    assert "no-cache" in resp.headers.get("Cache-Control", "")


def test_manifest_is_valid_and_icons_exist():
    resp = client.get("/manifest.webmanifest")
    assert resp.status_code == 200
    assert resp.headers["Content-Type"].startswith("application/manifest+json")
    manifest = json.loads(resp.data)
    assert manifest["name"]
    for icon in manifest["icons"]:
        assert (ROOT / icon["src"].lstrip("/")).exists(), icon["src"]


def test_daily_api_shape_and_no_store(monkeypatch):
    class ScheduledDate(date):
        @classmethod
        def today(cls):
            return cls(2026, 10, 22)

    monkeypatch.setattr(app_module, "date", ScheduledDate)
    resp = client.get("/api/daily")
    assert resp.status_code == 200
    assert resp.headers.get("Cache-Control") == "no-store"
    payload = resp.get_json()
    assert payload["date"]
    assert len(payload["questions"]) == 5


def _pin_today(monkeypatch, year=2026, month=10, day=22):
    class PinnedDate(date):
        @classmethod
        def today(cls):
            return cls(year, month, day)

    monkeypatch.setattr(app_module, "date", PinnedDate)


def test_daily_serves_client_local_date_within_one_day(monkeypatch):
    _pin_today(monkeypatch, day=15, month=11)  # server (UTC) day: 2026-11-15
    for client_day in ["2026-11-14", "2026-11-15", "2026-11-16"]:
        resp = client.get(f"/api/daily?date={client_day}")
        assert resp.status_code == 200, client_day
        payload = resp.get_json()
        assert payload["date"] == client_day
        assert len(payload["questions"]) == 5


def test_daily_rejects_dates_outside_the_timezone_window(monkeypatch):
    _pin_today(monkeypatch, day=15, month=11)
    # All of these are real scheduled rounds — they must still be refused,
    # so a moved device clock cannot peek at future questions.
    for client_day in ["2026-11-13", "2026-11-17", "2026-12-25", "2027-01-19"]:
        resp = client.get(f"/api/daily?date={client_day}")
        assert resp.status_code == 400, client_day


def test_daily_rejects_malformed_date(monkeypatch):
    _pin_today(monkeypatch)
    for bad in ["banana", "2026-13-01", "10/22/2026", ""]:
        resp = client.get(f"/api/daily?date={bad}")
        assert resp.status_code == 400, bad


def test_junior_echoes_client_local_date(monkeypatch):
    _pin_today(monkeypatch, day=15, month=11)
    resp = client.get("/api/junior?date=2026-11-14")
    assert resp.status_code == 200
    assert resp.get_json()["date"] == "2026-11-14"
    resp = client.get("/api/junior?date=2026-12-25")
    assert resp.status_code == 400


def test_practice_and_junior_apis_return_five():
    for path in ["/api/practice", "/api/junior", "/api/junior-practice"]:
        resp = client.get(path)
        assert resp.status_code == 200, path
        assert len(resp.get_json()["questions"]) == 5, path


def test_static_assets_are_immutable():
    resp = client.get("/static/style.css")
    assert resp.status_code == 200
    assert "immutable" in resp.headers.get("Cache-Control", "")


def test_question_calendar_is_complete():
    calendar = json.loads((ROOT / "static" / "question-calendar.json").read_text())
    days = sorted(calendar)
    assert len(days) == 90
    start = date(2026, 10, 22)
    for i, day in enumerate(days):
        expected = (start + timedelta(days=i)).isoformat()
        assert day == expected, f"gap or drift at {day}, expected {expected}"
    for day in days:
        assert len(calendar[day]) == 5, f"{day} does not have 5 questions"
    prompts = [q["prompt"] for day in days for q in calendar[day]]
    assert len(prompts) == 450
    assert len(set(prompts)) == 450, "duplicate questions in the calendar"
