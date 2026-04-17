"""broker_client.py — HMAC-signed calls to executor API"""
import hashlib, hmac, json, time
import requests

BASE = "https://orinai.org/api/executor"

def _sign(secret, body):
    ts = str(int(time.time()))
    sig = hmac.new(secret.encode(), f"{ts}\n{body}".encode(), hashlib.sha256).hexdigest()
    return ts, sig

def _post(path, pair_id, secret, data):
    body = json.dumps({**data, "pair_id": pair_id})
    ts, sig = _sign(secret, body)
    r = requests.post(f"{BASE}{path}", data=body,
        headers={"Content-Type":"application/json","X-Timestamp":ts,"X-Signature":sig}, timeout=30)
    r.raise_for_status(); return r.json()

def ping(pair_id, secret): return _post("/agent/ping", pair_id, secret, {})
def next_job(pair_id, secret): return _post("/agent/jobs/next", pair_id, secret, {})
def complete(pair_id, secret, job_id, status, progress, result=None, error=None):
    return _post("/agent/jobs/complete", pair_id, secret,
        {"job_id":job_id,"status":status,"progress":progress,"result":result,"error":error})
