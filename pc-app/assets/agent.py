#!/usr/bin/env python3
"""
Orin PC Agent — agent.py
Polls broker queue, routes to executor, reports results.
"""
import sys, time, json, traceback
from pathlib import Path

# Auto-install requests
try: import requests
except ImportError:
    import subprocess; subprocess.run([sys.executable,"-m","pip","install","requests"],check=True)
    import requests

import executor, broker_client

POLL_SEC  = 3
PING_SEC  = 60
STATE     = Path.home() / ".orin_agent.json"

def load_state():
    try: return json.loads(STATE.read_text())
    except: return {}

def save_state(s): STATE.write_text(json.dumps(s, indent=2))

def pair(pair_code=None):
    s = load_state()
    if s.get("pair_id") and s.get("hmac_secret"):
        print(f"  Paired: {s['pair_id'][:16]}…"); return s
    if not pair_code:
        print("  Go to orinai.org → Agent → Desktop Agent → Generate Code")
        pair_code = input("  Enter 6-char code: ").strip().upper()
        pair_id   = input("  Enter pair_id shown below the code: ").strip()
    r = requests.post(
        "https://orinai.org/api/executor/pair/agent-handshake",
        json={"pair_id": pair_id, "pair_code": pair_code}, timeout=30)
    r.raise_for_status()
    data = r.json()
    s.update({"pair_id": pair_id, "hmac_secret": data["hmac_secret"]})
    save_state(s); print(f"  Paired ✓"); return s

def run():
    print("╔══════════════════════════╗"); print("║   Orin AI PC Agent v2    ║"); print("╚══════════════════════════╝")
    s = pair()
    pair_id, secret = s["pair_id"], s["hmac_secret"]
    last_ping = 0.0
    print(f"  Polling every {POLL_SEC}s  Ctrl+C to stop\n")
    while True:
        now = time.time()
        if now - last_ping >= PING_SEC:
            try: broker_client.ping(pair_id, secret); last_ping = now; print(f"  [{time.strftime('%H:%M')}] ♥ online")
            except Exception as e: print(f"  ping err: {e}")
        try:
            data = broker_client.next_job(pair_id, secret)
            job  = data.get("job")
            if job:
                print(f"  ▶ {job['job_id'][:8]} {job['task']} {json.dumps(job.get('params',{}))[:60]}")
                broker_client.complete(pair_id, secret, job["job_id"], "running", 10)
                try:
                    result = executor.run(job["task"], job.get("params", {}))
                    broker_client.complete(pair_id, secret, job["job_id"], "done", 100, result=result)
                    print(f"  ✅ {result.get('message','OK')}")
                except Exception as e:
                    broker_client.complete(pair_id, secret, job["job_id"], "failed", 0, error=str(e))
                    print(f"  ❌ {e}")
        except KeyboardInterrupt: print("\n  Bye!"); break
        except Exception as e: print(f"  poll err: {e}")
        try: time.sleep(POLL_SEC)
        except KeyboardInterrupt: print("\n  Bye!"); break

if __name__ == "__main__": run()
