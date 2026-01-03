# Monitor — Static Dashboard Demo

This folder contains a static, client-side dashboard that demonstrates monitoring results and charts. It's designed to be deployable to GitHub Pages (no backend required).

What this delivers
- `dashboard.html` — static dashboard using `sample-data.json`
- `sample-data.json` — pre-recorded check history used by the demo
- `static/monitor.js` — client renderer using Chart.js

How to test locally
1. From repository root, run a simple static server (recommended):

```powershell
npx live-server --port=8000
```

Or use Python built-in server:

```powershell
python -m http.server 8000
```

2. Open `http://127.0.0.1:8000/monitor/dashboard.html` in your browser.

Deploy to GitHub Pages
- Commit and push the repository to GitHub.
- In the repository Settings > Pages, set the source to the `main` branch (root) or `gh-pages` branch if you prefer.
- After publishing, the static dashboard will be available at `https://<your-username>.github.io/<repo>/monitor/dashboard.html`.

Notes and next steps
- This static demo is intentionally client-side only. To run real site checks from a server (no CORS issues) you can add a small Python FastAPI service that runs periodic checks and writes results to a database — see earlier notes in the main README.
- If you want, I can scaffold a lightweight server and Dockerfile and add an API so the GitHub Pages dashboard can fetch live results from your server.
# Monitor — simple site-monitoring tool

Короткий учебный проект: Python-скрипт для проверки доступности URL, измерения задержки и логирования результатов в CSV.

Файлы
- `monitor.py` — основной скрипт (CLI).
- `urls.txt` — пример списка URL (один в строке).
- `requirements.txt` — зависимости.

Пример использования

```bash
pip install -r monitor/requirements.txt
python monitor/monitor.py --urls monitor/urls.txt --output monitor/results.csv --once
```

Описание
- Скрипт читает `urls.txt`, выполняет параллельные GET-запросы и сохраняет в CSV: timestamp, url, status, ok, elapsed_ms, error.
- Для непрерывного мониторинга можно расширить скрипт добавив `--interval` и цикл.

Примечания
- Для работы требуется пакет `requests`.
