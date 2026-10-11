# AstraPulse

**Professional realtime spaceflight command center**

Track launches, missions, astronauts, agencies, space stations, vehicles, the ISS, Starlink and satellites — all in one sleek dashboard.

![AstraPulse](https://img.shields.io/badge/status-live-22c55e) ![License](https://img.shields.io/badge/license-MIT-38bdf8)

## Features

- **Launches** — Upcoming & historical orbital (and selected suborbital) launches worldwide
- **Events** — Spacewalks, landings, tests, and other spaceflight events
- **Astronauts** — Searchable database of past, present and future spacefarers
- **Agencies** — Every major space agency and commercial launch provider
- **Space Stations** — ISS, Tiangong and historical stations + expeditions & dockings
- **Vehicles** — Launch vehicles, reusable first stages, spacecraft configurations
- **Satellites & Starlink** — Live constellation counts and station TLE data via CelesTrak
- **ISS Tracker** — Near-realtime position, altitude, velocity and ground track
- **Global Search** — Unified search across launches and astronauts
- **Asteroids (NeoWs)** — Near-Earth objects this week, miss distances, hazard flags
- **Space Weather (DONKI)** — Solar flares, CMEs, geomagnetic storms on the dashboard
- **EPIC Earth** — Latest full-disk Earth image from DSCOVR
- **NASA Photos** — Searchable mission photo browser (Image & Video Library)
- **Auto-refresh** — ISS every 30 s, dashboard soft-refresh every 2 minutes
- **Rate-limit aware** — Respects Launch Library 2 free tier (15 req/hour)

## Data Sources

| Source | Usage |
|--------|--------|
| [Launch Library 2](https://thespacedevs.com/llapi) (The Space Devs) | Launches, events, agencies, astronauts, stations, vehicles, pads… |
| [Open Notify](http://open-notify.org) | People currently in space |
| [Where the ISS at?](https://wheretheiss.at) | High-frequency ISS position |
| [NASA NeoWs](https://api.nasa.gov) | Near-Earth asteroids |
| [NASA DONKI](https://api.nasa.gov) | Space weather (CME, flares, storms) |
| [NASA EPIC](https://api.nasa.gov) | Full-disk Earth imagery |
| [NASA Image Library](https://images-api.nasa.gov) | Mission photo search |
| [CelesTrak](https://celestrak.org) | Starlink & station orbital elements (GP) |
| [NASA APOD](https://api.nasa.gov) | Astronomy Picture of the Day |

> **Rate limits:** LL2 free tier allows **15 non-authenticated requests per hour**.  
> AstraPulse caches aggressively and falls back to the public `lldev` endpoint when the production quota is exhausted.  
> For production traffic consider a [Patreon-supported API key](https://thespacedevs.com/supportus).

## Quick Start (GitHub Pages)

1. Create a new repository on GitHub (e.g. `astrapulse`).
2. Upload the contents of this folder (or push via git).
3. Go to **Settings → Pages** → Source: **Deploy from a branch** → `main` / `/ (root)`.
4. Visit `https://<username>.github.io/astrapulse/`.

No build step required — pure static HTML/CSS/JS.

## Local Development

```bash
# Any static server works
npx serve .
# or
python -m http.server 8080
```

Open `http://localhost:8080`.

## Configuration

Edit `js/config.js`:

- `NASA_KEY` — already configured with your NASA API key for APOD and other NASA endpoints.
- `useProduction` — set `false` to force `lldev` (unlimited, stale data) during heavy development.
- Refresh intervals and cache TTLs are fully tunable.

## Project Structure

```
AstraPulse/
├── index.html          # App shell
├── css/styles.css      # Dark modern UI
├── js/
│   ├── config.js       # Endpoints, cache, rate-limit config
│   ├── api.js          # API layer + caching + LL2 throttle
│   ├── ui.js           # View renderers & components
│   └── app.js          # Router, timers, bootstrap
└── README.md
```

## Tech Stack

- Vanilla JS (no framework lock-in)
- Leaflet.js for ISS map
- CSS custom properties, modern layout
- localStorage caching with TTL
- Hash-based routing (GitHub Pages friendly)

## License

MIT — free for personal and commercial use.  
Data remains copyright of the respective providers (The Space Devs, NASA, CelesTrak, etc.).

---

Built for the open space community.  
**AstraPulse** · Track the frontier.
