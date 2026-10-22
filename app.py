import os
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

DAILY_QUESTIONS = [
    {"id":"circumference","type":"number","title":"One lap around the world","prompt":"About how many miles is the Earth's circumference at the equator?","unit":"miles","answer":24901,"hint":"Think tens of thousands, not hundreds of thousands.","explanation":"The equatorial circumference is about 24,901 miles."},
    {"id":"bugs","type":"number","title":"A very long line of Beetles","prompt":"About how many 1962 Volkswagen Beetles, bumper to bumper, would stretch the length of the Great Wall of China?","unit":"cars","answer":5700000,"hint":"The Great Wall is roughly 13,000 miles long; a Beetle is about 12 feet long.","explanation":"Using about 13,000 miles and a 12-foot Beetle gives roughly 5.7 million. Estimates vary with what counts as the Great Wall."},
    {"id":"water","type":"percent","title":"The blue planet","prompt":"What percentage of Earth's surface is covered by water?","unit":"%","answer":71,"hint":"A little more than two thirds.","explanation":"About 71% of Earth's surface is covered by water."},
    {"id":"population","type":"number","title":"A city of millions","prompt":"Approximately how many people live in Tokyo's metropolitan area?","unit":"million people","answer":37,"hint":"Give your answer in millions. Think somewhere in the 30s.","explanation":"Tokyo's metropolitan area has around 37 million residents, depending on the boundary used."},
    {"id":"coordinates","type":"map","title":"Pinpoint the place","prompt":"Drop a pin near the Great Pyramid of Giza, Egypt.","unit":"km","answer":{"lat":29.9792,"lng":31.1342},"hint":"Look in northern Egypt, just west of the Nile Delta.","explanation":"The Great Pyramid is at about 29.979° N, 31.134° E."},
]

NUMBER_BANK = [
    DAILY_QUESTIONS[0], DAILY_QUESTIONS[1], DAILY_QUESTIONS[2], DAILY_QUESTIONS[3],
    {"id":"nile","type":"number","title":"A river with reach","prompt":"About how many miles long is the Nile River?","unit":"miles","answer":4132,"hint":"A little over four thousand miles.","explanation":"The Nile is about 4,132 miles long, though river measurements vary by source."},
    {"id":"eiffel","type":"number","title":"A tower with a tip","prompt":"How many feet tall is the Eiffel Tower, including its antenna?","unit":"feet","answer":1083,"hint":"Just over a thousand feet.","explanation":"The Eiffel Tower stands about 1,083 feet tall including its antenna."},
    {"id":"heartbeats","type":"number","title":"A busy little heart","prompt":"About how many times does the average adult heart beat in a day?","unit":"beats","answer":100000,"hint":"Around one hundred thousand.","explanation":"A typical resting heart rate adds up to roughly 100,000 beats a day."},
    {"id":"moon-distance","type":"number","title":"A familiar neighbor","prompt":"About how many miles away is the Moon on average?","unit":"miles","answer":238855,"hint":"A little under a quarter million miles.","explanation":"The average Earth–Moon distance is about 238,855 miles."},
    {"id":"everest","type":"number","title":"Above the clouds","prompt":"How many feet tall is Mount Everest?","unit":"feet","answer":29032,"hint":"Just over 29,000 feet.","explanation":"Mount Everest is about 29,032 feet above sea level."},
    {"id":"speedlight","type":"number","title":"Speed of light","prompt":"About how many miles per second does light travel in a vacuum?","unit":"miles per second","answer":186282,"hint":"Around 186 thousand.","explanation":"Light travels about 186,282 miles per second in a vacuum."},
    {"id":"amazon","type":"percent","title":"A river basin","prompt":"About what percentage of the world's known species are found in the Amazon rainforest?","unit":"%","answer":10,"hint":"Roughly one in ten.","explanation":"The Amazon is home to an estimated 10% of known species."},
]
MAP_SPOTS = [
    {"lat":29.9792,"lng":31.1342,"name":"The Great Pyramid is at about 29.979° N, 31.134° E."},
    {"lat":48.8584,"lng":2.2945,"name":"The Eiffel Tower is at about 48.858° N, 2.295° E."},
    {"lat":27.1751,"lng":78.0421,"name":"The Taj Mahal is at about 27.175° N, 78.042° E."},
    {"lat":40.6892,"lng":-74.0445,"name":"The Statue of Liberty is at about 40.689° N, 74.045° W."},
    {"lat":-13.1631,"lng":-72.545,"name":"Machu Picchu is at about 13.163° S, 72.545° W."},
]

def todays_questions():
    day = date.today()
    offset = (day - date(2026, 1, 1)).days % len(NUMBER_BANK)
    numbers = [NUMBER_BANK[(offset + i) % len(NUMBER_BANK)] for i in range(4)]
    spot = MAP_SPOTS[(day - date(2026, 1, 1)).days % len(MAP_SPOTS)]
    final = {"id":"coordinates","type":"map","title":"Pinpoint the place","prompt":"Drop a pin near " + spot["name"].split(" is at")[0] + ".","unit":"km","answer":{"lat":spot["lat"],"lng":spot["lng"]},"hint":"Look for the landmark on the map.","explanation":spot["name"]}
    return numbers + [final]

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
    elif request.path == "/":
        response.headers["Cache-Control"] = "no-cache"
    return response

@app.get("/api/daily")
def daily():
    return jsonify({"date": date.today().isoformat(), "questions": todays_questions()})

@app.get("/api/practice")
def practice():
    return jsonify({"questions": PRACTICE_QUESTIONS})

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", "8000")), debug=os.environ.get("DEBUG") == "1")
