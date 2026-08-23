#!/usr/bin/env python3
"""
Orin PC Agent — agent.py
Polls the executor job queue, routes to executor, reports results.

Pairing:
  1. Manual: run and paste pair_id + 6-char code from orinai.org.
  2. Automatic (desktop app): the Electron shell writes {"pending_pair":
     {"pair_id": ..., "pair_code": ...}} into this state file; we complete the
     handshake ourselves on the next loop iteration.
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
LONG_POLL_WAIT = 20   # server holds the request open until a job is due (cuts idle requests ~8x)
PING_SEC  = 60
STATE     = Path.home() / ".orin_agent.json"

def load_state():
    try: return json.loads(STATE.read_text())
    except Exception: return {}

def save_state(s): STATE.write_text(json.dumps(s, indent=2))

def handshake(pair_id, pair_code):
    r = requests.post(
        "https://orinai.org/api/executor/pair/agent-handshake",
        json={"pair_id": pair_id, "pair_code": pair_code}, timeout=30)
    if r.status_code != 200:
        raise RuntimeError(r.json().get("error", f"HTTP {r.status_code}") if r.headers.get("content-type","").startswith("application/json") else f"HTTP {r.status_code}")
    data = r.json()
    return data["hmac_secret"]

def pair():
    s = load_state()
    if s.get("pair_id") and s.get("hmac_secret"):
        print(f"  Paired: {s['pair_id'][:16]}…"); return s

    pending = s.get("pending_pair")
    if isinstance(pending, dict) and pending.get("pair_id") and pending.get("pair_code"):
        # Desktop-app auto-pairing: credentials were staged by Electron.
        try:
            secret = handshake(pending["pair_id"], str(pending["pair_code"]).upper())
        except Exception as e:
            print(f"  auto-pair failed ({e}); will retry")
            time.sleep(POLL_SEC); return None
        s.pop("pending_pair", None)
        s["pair_id"], s["hmac_secret"] = pending["pair_id"], secret
        save_state(s); print(f"  Paired ✓ (auto)"); return s

    print("  Go to orinai.org → Agent → Desktop Agent → Generate Code")
    pair_code = input("  Enter 6-char code: ").strip().upper()
    pair_id   = input("  Enter pair_id shown below the code: ").strip()
    secret = handshake(pair_id, pair_code)
    s.update({"pair_id": pair_id, "hmac_secret": secret})
    save_state(s); print(f"  Paired ✓"); return s

class Revoked(Exception):
    pass

def run():
    print("╔══════════════════════════╗"); print("║   Orin AI PC Agent v2    ║"); print("╚══════════════════════════╝")
    s = pair()
    if not s: return  # auto-pair pending; Electron restarts us after writing state
    last_ping = 0.0
    print(f"  Polling every {POLL_SEC}s  Ctrl+C to stop\n")
    while True:
        now = time.time()
        if now - last_ping >= PING_SEC:
            try: broker_client.ping(s["pair_id"], s["hmac_secret"]); last_ping = now; print(f"  [{time.strftime('%H:%M')}] ♥ online")
            except requests.HTTPError as e:
                code = e.response.status_code if e.response is not None else 0
                if code in (401, 403, 404):
                    print("  Pair revoked or invalid — clearing state. Re-pair from orinai.org.")
                    s2 = load_state(); s2.pop("pair_id", None); s2.pop("hmac_secret", None); save_state(s2)
                    return  # exit cleanly; desktop app can restart us once re-paired
            except Exception as e: print(f"  ping err: {e}")
        try:
            data = broker_client.next_job(s["pair_id"], s["hmac_secret"], wait=LONG_POLL_WAIT)
            job  = data.get("job")
            if job:
                print(f"  ▶ {job['job_id'][:8]} {job['task']} {json.dumps(job.get('params',{}))[:60]}")
                broker_client.complete(s["pair_id"], s["hmac_secret"], job["job_id"], "running", 10)
                try:
                    result = executor.run(job["task"], job.get("params", {}))
                    broker_client.complete(s["pair_id"], s["hmac_secret"], job["job_id"], "done", 100, result=result)
                    print(f"  ✅ {result.get('message','OK')}")
                except Exception as e:
                    broker_client.complete(s["pair_id"], s["hmac_secret"], job["job_id"], "failed", 0, error=str(e))
                    print(f"  ❌ {e}")
        except KeyboardInterrupt: print("\n  Bye!"); break
        except requests.HTTPError as e:
            code = e.response.status_code if e.response is not None else 0
            if code in (401, 403):
                # Signature/state may have been refreshed by the desktop app — re-read state file.
                fresh = load_state()
                if fresh.get("hmac_secret") != s.get("hmac_secret"):
                    s = fresh; print("  Credentials updated by desktop app; continuing.")
                else:
                    print("  Pair revoked or invalid — exiting. Re-pair from orinai.org."); break
            else:
                print(f"  poll err: {e}")
        except Exception as e: print(f"  poll err: {e}")
        try: time.sleep(1)   # long-poll already waits server-side; brief gap only
        except KeyboardInterrupt: print("\n  Bye!"); break

if __name__ == "__main__": run()
