# Five Big Things

A daily five-question estimation game. The first two questions are multiple choice; the last question is a map pin scored by distance. Scores are weighted to a 1,000-point maximum: 100, 100, 200, 300, and 300. Players can share per-question results and play unlimited free practice rounds. The first version has no accounts, cross-device score history, or paid features.

## Run locally

Use Python 3.9 or newer for local play:

```sh
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python app.py
```

Open http://localhost:8000. A completed daily round is remembered in that browser so it cannot be replayed there until the next day. This is local browser state; no score or personal information is sent to the server.

## What's included

- A date-keyed daily calendar with five scheduled questions per day from October 22, 2026 through January 19, 2027. Each round has four number estimates and a final map pin.
- A drag-to-rotate 3D Earth for the final coordinate guess, with scored pins and a reveal view. The globe uses globe.gl and NASA Blue Marble imagery; without WebGL it falls back to a clickable flat Earth image, then coordinate entry.
- Free practice rounds, score explanations, distance-based map scoring, and share/copy score actions.
- A lightweight Flask app with no database or account data. Static files are read into memory at startup, which also makes them available to Fastly Compute's Python runtime.

The calendar is stored in `static/question-calendar.json` and bundled with the app. Numeric estimates include an explanatory note; some geographic and historical measurements vary by source or definition.

The globe renderer is pinned to globe.gl 2.46.2 on jsDelivr, and its image is loaded from NASA's Blue Marble collection. No map API key or paid map account is needed. Before launch, bundle these assets locally so the game does not depend on third-party delivery.

## Plans & design docs

The backlog, the iOS/native plan, the /junior + /globe spec, the corporate
training framework, and the Faces design note live in [`plans/`](plans/).

## Fastly Compute deployment

This project includes a Fastly Compute Python entry point. Fastly's Python SDK builds Flask into WebAssembly and is currently beta; it needs Python 3.12+ and `uv`. The local app supports Python 3.9+, but the Compute build does not. [Fastly's Python guide](https://www.fastly.com/documentation/guides/compute/developer-guides/python/)

Before deploying, make sure Compute is enabled for the Fastly account. The CLI will reject service creation when the account plan does not include Compute; product enablement or purchase is managed in the Fastly control panel. Review any displayed trial or billing terms before enabling it. [Fastly product purchases and trials](https://www.fastly.com/documentation/guides/organizations-and-accounts/billing/managing-product-purchases-and-trials/)

After installing Python 3.12+, `uv`, and the Fastly CLI, authenticate with a rotated Fastly API token, then:

```sh
uv sync
fastly compute build
fastly compute serve
fastly compute deploy
```

The first deploy creates a Fastly Compute service. Use the service's generated Fastly hostname to review the app, then attach `fivebigthings.app` and provision TLS in Fastly. Only after Fastly confirms the domain and TLS are ready should GoDaddy DNS be pointed at Fastly's provided records. [Fastly Compute setup](https://www.fastly.com/documentation/guides/compute/getting-started-with-compute/)

The round and practice APIs return `Cache-Control: no-store`; daily question selection uses the Compute runtime's current date and the published calendar. Scores exist only in each player's browser and can be shared manually. There is no account-based persistence or payment integration in this version.
