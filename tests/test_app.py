"""Route, API, and content-integrity tests for fivebigthings.app.

These guard the promises the app makes: every page route answers, the daily
round can never be served from a cache, the service worker is root-scoped,
and the question calendar is complete and gap-free.
"""
import hashlib
import json
import re
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
        assert (ROOT / icon["src"].split("?")[0].lstrip("/")).exists(), icon["src"]


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


STATIC_SOURCES = ["index.html", "junior.html", "globe.html", "offline.html", "sw.js", "manifest.webmanifest"]
SERVED = {"/": "index.html", "/junior": "junior.html", "/globe": "globe.html", "/offline.html": "offline.html",
          "/sw.js": "sw.js", "/manifest.webmanifest": "manifest.webmanifest"}


def test_sources_never_hand_version_static_urls():
    # app.py stamps ?v=<content hash> at startup; a hand-written ?v= would go stale.
    for name in STATIC_SOURCES:
        text = (ROOT / "static" / name).read_text()
        assert not re.search(r"/static/[\w./-]+\?v=", text), f"remove the hand-written ?v= in static/{name}"


def test_served_static_urls_carry_their_content_hash():
    for path, name in SERVED.items():
        body = client.get(path).get_data(as_text=True)
        refs = re.findall(r"/(static/[\w./-]+)\?v=(\w+)", body)
        source_refs = re.findall(r"/(static/[\w./-]+)", (ROOT / "static" / name).read_text())
        assert len(refs) == len([r for r in source_refs if (ROOT / r).is_file()]), path
        for asset, version in refs:
            assert version == hashlib.sha256((ROOT / asset).read_bytes()).hexdigest()[:10], (path, asset)


def test_service_worker_version_tracks_the_shell(monkeypatch):
    body = client.get("/sw.js").get_data(as_text=True)
    version = re.search(r"const VERSION = 'fbt-(\w+)'", body).group(1)
    assert version != "__ASSET_VERSION__" and "__ASSET_VERSION__" not in body
    # Changing any shell file must change the service worker's VERSION.
    monkeypatch.setitem(app_module.ASSET_HASH, "static/engine.js", "changed000")
    changed = app_module.render_service_worker().decode("utf-8")
    assert re.search(r"const VERSION = 'fbt-(\w+)'", changed).group(1) != version


def test_question_calendar_is_complete():
    calendar = json.loads((ROOT / "data" / "question-calendar.json").read_text())
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


def test_question_data_is_not_publicly_downloadable():
    # The calendar holds every future round with its answers; serving it
    # would let anyone skip the /api/daily date window and read ahead.
    for path in ["/static/question-calendar.json", "/static/junior-questions.json"]:
        assert client.get(path).status_code == 404, path
    for key in app_module.ASSETS:
        assert not key.endswith(("question-calendar.json", "junior-questions.json")), key
