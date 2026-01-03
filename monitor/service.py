import os
import sys
import time
from typing import List, Optional, Dict, Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from starlette.staticfiles import StaticFiles
from starlette.responses import RedirectResponse, FileResponse
from pydantic import BaseModel

# Ensure local `alerts.py` can be imported when service is run from project root
sys.path.insert(0, os.path.dirname(__file__))
import alerts


class CheckItem(BaseModel):
    t: int
    lat: Optional[float] = None
    status: Optional[int] = None


class CheckRequest(BaseModel):
    site_id: str
    history: List[CheckItem]
    rules: Optional[Dict[str, Any]] = None


app = FastAPI(title='Monitor Service')

app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

# serve the `monitor/` folder as static files at /monitor
app.mount('/monitor', StaticFiles(directory=os.path.dirname(__file__)), name='monitor')


@app.get('/')
def root():
    # Prefer serving the main project index.html by default
    return RedirectResponse('/index.html')


@app.get('/index.html')
def project_index():
    # Serve the project's top-level index.html over HTTP
    project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
    index_path = os.path.join(project_root, 'index.html')
    if not os.path.exists(index_path):
        raise HTTPException(status_code=404, detail='index.html not found')
    return FileResponse(index_path, media_type='text/html')


@app.on_event('startup')
def startup():
    # Initialize alerts DB
    alerts.init_db()


@app.post('/api/check')
def api_check(payload: CheckRequest):
    site_id = payload.site_id
    history = [h.dict() for h in payload.history]
    rules = payload.rules

    # Skip processing if site is muted
    if alerts.is_site_muted(site_id):
        return {'created': [], 'muted': True}

    # Evaluate rules
    try:
        new_alerts = alerts.evaluate_rules(site_id, history, rules)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f'evaluate_rules error: {e}')

    created = []
    for a in new_alerts:
        sev = a.get('severity', 'warning')
        reason = a.get('reason', '')
        meta = a.get('meta')
        aid = alerts.add_alert(site_id, sev, reason, meta)
        created.append({'id': aid, 'severity': sev, 'reason': reason, 'meta': meta})

    # Placeholder for notifications (Telegram etc.) — to be implemented
    if created:
        print(f'Generated {len(created)} alert(s) for {site_id}')

    return {'created': created, 'muted': False}


@app.get('/api/alerts')
def api_get_alerts(limit: int = 100, site_id: Optional[str] = None):
    alerts_list = alerts.get_alerts(limit=limit, site_id=site_id)
    return {'alerts': alerts_list}


if __name__ == '__main__':
    import uvicorn

    uvicorn.run('monitor.service:app', host='0.0.0.0', port=8002, reload=False)
