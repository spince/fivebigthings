import os
import json
import mimetypes
from datetime import date
from pathlib import Path

from flask import Flask, Response, jsonify, request

ROOT = Path(__file__).parent
STATIC_ROOT = ROOT / "static"
ASSETS = {
    path.relative_to(ROOT).as_posix(): path.read_bytes()
    for path in STATIC_ROOT.rglob("*") if path.is_file()
}
app = Flask(__name__, static_folder=None)

QUESTION_CALENDAR = json.loads(ASSETS["static/question-calendar.json"])
JUNIOR_QUESTIONS = json.loads(ASSETS["static/junior-questions.json"])

PRACTICE_QUESTIONS = [
    {"id":"moon","type":"number","title":"The long way to the Moon","prompt":"About how many miles away is the Moon on average?","unit":"miles","answer":238855,"hint":"A little under a quarter million miles.","explanation":"The average Earth–Moon distance is about 238,855 miles."},
    {"id":"everest","type":"number","title":"Above the clouds","prompt":"How many feet tall is Mount Everest?","unit":"feet","answer":29032,"hint":"Just over 29,000 feet.","explanation":"Mount Everest is about 29,032 feet above sea level."},
    {"id":"speedlight","type":"number","title":"Speed of light","prompt":"About how many miles per second does light travel in a vacuum?","unit":"miles per second","answer":186282,"hint":"Around 186 thousand.","explanation":"Light travels about 186,282 miles per second in a vacuum."},
    {"id":"amazon","type":"percent","title":"A river basin","prompt":"About what percentage of the world's known species are found in the Amazon rainforest?","unit":"%","answer":10,"hint":"Roughly one in ten.","explanation":"The Amazon is home to an estimated 10% of known species."},
    {"id":"practice-coordinates","type":"map","title":"Pinpoint the place","prompt":"Drop a pin near the Great Pyramid of Giza, Egypt.","unit":"km","answer":{"lat":29.9792,"lng":31.1342},"hint":"Look in northern Egypt, just west of the Nile Delta.","explanation":"The Great Pyramid is at about 29.979° N, 31.134° E."},
]

@app.get("/")
def index():
    return Response(ASSETS["static/index.html"], mimetype="text/html")

@app.get("/static/<path:asset_path>")
def static_asset(asset_path):
    key = f"static/{asset_path}"
    content = ASSETS.get(key)
    if content is None:
        return "Not found", 404
    response = Response(content, mimetype=mimetypes.guess_type(key)[0] or "application/octet-stream")
    response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
    return response

@app.after_request
def prevent_api_caching(response):
    if request.path.startswith("/api/"):
        response.headers["Cache-Control"] = "no-store"
    elif request.path in {"/", "/junior", "/globe", "/sw.js", "/manifest.webmanifest", "/offline.html"}:
        response.headers["Cache-Control"] = "no-cache"
    return response

@app.get("/api/daily")
def daily():
    day = date.today().isoformat()
    questions = QUESTION_CALENDAR.get(day)
    if questions is None:
        return jsonify({"error": "Today's round is not scheduled yet.", "date": day}), 503
    return jsonify({"date": day, "questions": questions})

@app.get("/api/practice")
def practice():
    return jsonify({"questions": PRACTICE_QUESTIONS})

@app.get("/junior")
def junior():
    return Response(ASSETS["static/junior.html"], mimetype="text/html")


@app.get("/globe")
def globe():
    return Response(ASSETS["static/globe.html"], mimetype="text/html")


@app.get("/sw.js")
def service_worker():
    # Served from the root so its scope is the whole origin; static files are
    # loaded into ASSETS at startup, so the bytes live under static/sw.js.
    response = Response(ASSETS["static/sw.js"], mimetype="application/javascript")
    response.headers["Service-Worker-Allowed"] = "/"
    return response


@app.get("/manifest.webmanifest")
def manifest():
    return Response(ASSETS["static/manifest.webmanifest"], mimetype="application/manifest+json")


@app.get("/offline.html")
def offline():
    return Response(ASSETS["static/offline.html"], mimetype="text/html")


@app.get("/api/junior")
def junior_daily():
    return jsonify({"date": date.today().isoformat(), "questions": JUNIOR_QUESTIONS["daily"]})


@app.get("/api/junior-practice")
def junior_practice():
    return jsonify({"questions": JUNIOR_QUESTIONS["practice"]})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", "8000")), debug=os.environ.get("DEBUG") == "1")
