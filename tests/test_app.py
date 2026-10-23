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

from app import app  # noqa: E402

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


def test_daily_api_shape_and_no_store():
    resp = client.get("/api/daily")
    assert resp.status_code == 200
    assert resp.headers.get("Cache-Control") == "no-store"
    payload = resp.get_json()
    assert payload["date"]
    assert len(payload["questions"]) == 5


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
