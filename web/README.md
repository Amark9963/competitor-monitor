# web

Next.js dashboard for the competitor monitor. See the [root README](../README.md) for setup.

```bash
npm install
npm run dev        # proxies /api to the Python backend at API_URL (default http://127.0.0.1:8000)
DEMO_MODE=1 npm run dev   # serves the bundled snapshot in src/data/snapshot.json instead
```

Deploy to Vercel with **Root Directory = `web`**; without an `API_URL` it runs in demo mode automatically.
