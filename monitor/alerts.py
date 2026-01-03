"""
monitor/alerts.py

Core alerting helper: DB schema and evaluation helpers.
This module is designed to be imported by a checker/service which
passes site check results (history or latest check) into evaluate_rules().

Functions:
- init_db(path): create tables
- add_alert(site_id, severity, reason, meta)
- get_alerts(...)
- ack_alert(alert_id)
- mute_site(site_id, until_ts)
- evaluate_rules(site_id, history, rules): returns list of alerts to create

Note: this is a self-contained module using sqlite3; later steps will
add API endpoints and integrate this into the checker pipeline.
"""

import sqlite3
import json
import time
from typing import List, Dict, Any, Optional

DEFAULT_DB = 'monitor/alerts.db'

CREATE_ALERTS_SQL = (
    'CREATE TABLE IF NOT EXISTS alerts ('
    'id INTEGER PRIMARY KEY AUTOINCREMENT,'
    'site_id TEXT NOT NULL,'
    'severity TEXT NOT NULL,'
    'reason TEXT NOT NULL,'
    'meta TEXT,'
    'ts INTEGER NOT NULL,'
    'acknowledged INTEGER DEFAULT 0'
    ');'
)

CREATE_MUTES_SQL = (
    'CREATE TABLE IF NOT EXISTS mutes ('
    'id INTEGER PRIMARY KEY AUTOINCREMENT,'
    'site_id TEXT NOT NULL,'
    'until_ts INTEGER NOT NULL,'
    'reason TEXT,'
    'ts INTEGER NOT NULL'
    ');'
)

def init_db(path: str = DEFAULT_DB):
    conn = sqlite3.connect(path)
    cur = conn.cursor()
    cur.execute(CREATE_ALERTS_SQL)
    cur.execute(CREATE_MUTES_SQL)
    conn.commit()
    conn.close()

def _get_conn(path: str = DEFAULT_DB):
    return sqlite3.connect(path)

def add_alert(site_id: str, severity: str, reason: str, meta: Optional[Dict[str,Any]]=None, db_path: str = DEFAULT_DB) -> int:
    ts = int(time.time() * 1000)
    meta_s = json.dumps(meta) if meta is not None else None
    conn = _get_conn(db_path)
    cur = conn.cursor()
    cur.execute('INSERT INTO alerts (site_id,severity,reason,meta,ts) VALUES (?,?,?,?,?)', (site_id,severity,reason,meta_s,ts))
    aid = cur.lastrowid
    conn.commit()
    conn.close()
    return aid

def get_alerts(limit: int = 100, since_ts: Optional[int]=None, site_id: Optional[str]=None, db_path: str = DEFAULT_DB) -> List[Dict[str,Any]]:
    conn = _get_conn(db_path)
    cur = conn.cursor()
    q = 'SELECT id,site_id,severity,reason,meta,ts,acknowledged FROM alerts'
    params = []
    where = []
    if since_ts is not None:
        where.append('ts >= ?'); params.append(since_ts)
    if site_id is not None:
        where.append('site_id = ?'); params.append(site_id)
    if where:
        q += ' WHERE ' + ' AND '.join(where)
    q += ' ORDER BY ts DESC LIMIT ?'
    params.append(limit)
    cur.execute(q, params)
    rows = cur.fetchall()
    conn.close()
    out = []
    for r in rows:
        meta = json.loads(r[4]) if r[4] else None
        out.append({'id': r[0], 'site_id': r[1], 'severity': r[2], 'reason': r[3], 'meta': meta, 'ts': r[5], 'acknowledged': bool(r[6])})
    return out

def ack_alert(alert_id: int, db_path: str = DEFAULT_DB) -> bool:
    conn = _get_conn(db_path)
    cur = conn.cursor()
    cur.execute('UPDATE alerts SET acknowledged = 1 WHERE id = ?', (alert_id,))
    ok = cur.rowcount > 0
    conn.commit()
    conn.close()
    return ok

def mute_site(site_id: str, until_ts: int, reason: Optional[str]=None, db_path: str = DEFAULT_DB) -> int:
    ts = int(time.time() * 1000)
    conn = _get_conn(db_path)
    cur = conn.cursor()
    cur.execute('INSERT INTO mutes (site_id,until_ts,reason,ts) VALUES (?,?,?,?)', (site_id, until_ts, reason, ts))
    mid = cur.lastrowid
    conn.commit()
    conn.close()
    return mid

def is_site_muted(site_id: str, db_path: str = DEFAULT_DB) -> bool:
    now = int(time.time() * 1000)
    conn = _get_conn(db_path)
    cur = conn.cursor()
    cur.execute('SELECT 1 FROM mutes WHERE site_id = ? AND until_ts > ? LIMIT 1', (site_id, now))
    r = cur.fetchone()
    conn.close()
    return r is not None

def evaluate_rules(site_id: str, history: List[Dict[str,Any]], rules: Optional[Dict[str,Any]] = None) -> List[Dict[str,Any]]:
    """
    Evaluate rules against site history.
    history: list of {t: ms_timestamp, lat: latency_ms, status: int}
    rules: dict with keys: latency_threshold_ms, consecutive_failures

    Returns list of alert dicts: {severity, reason, meta}
    """
    if not history:
        return []
    r = rules or {}
    lat_th = int(r.get('latency_threshold_ms', 1000))
    cons_fail = int(r.get('consecutive_failures', 3))
    alerts = []

    # 1) latency threshold: if latest latency > threshold
    latest = history[-1]
    if latest.get('lat', 0) > lat_th:
        alerts.append({'severity': 'warning', 'reason': f'High latency > {lat_th}ms', 'meta': {'lat': latest.get('lat')}})

    # 2) status not 2xx/3xx
    if not (200 <= latest.get('status', 0) < 400):
        alerts.append({'severity': 'critical', 'reason': f'Status {latest.get("status")}', 'meta': {'status': latest.get('status')}})

    # 3) N consecutive failures (status non-2xx/3xx)
    if cons_fail > 0:
        cnt = 0
        for h in reversed(history):
            if 200 <= h.get('status', 0) < 400:
                break
            cnt += 1
            if cnt >= cons_fail:
                alerts.append({'severity': 'critical', 'reason': f'{cnt} consecutive failures', 'meta': {'count': cnt}})
                break

    return alerts

if __name__ == '__main__':
    # quick self-check
    init_db()
    print('alerts DB initialized at', DEFAULT_DB)
