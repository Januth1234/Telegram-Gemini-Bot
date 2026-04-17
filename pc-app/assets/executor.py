"""executor.py — runs individual tasks on the PC"""
import os, platform, subprocess, traceback
from pathlib import Path

def run(task: str, params: dict) -> dict:
    fn = TASKS.get(task)
    if not fn: return {"error": f"Unknown task: {task}"}
    try: return fn(params)
    except Exception as e: return {"error": str(e), "tb": traceback.format_exc()[:300]}

def _shell(params):
    cmd = params.get("command","")
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=30)
    return {"stdout": r.stdout[:1000], "returncode": r.returncode, "message": f"Exit {r.returncode}"}

def _open_app(params):
    app = params.get("app","")
    sys = platform.system()
    if sys=="Windows": os.startfile(app)
    elif sys=="Darwin": subprocess.Popen(["open","-a",app])
    else: subprocess.Popen([app])
    return {"message": f"Launched: {app}"}

def _type_text(params):
    try:
        import pyautogui; import time; time.sleep(1)
        pyautogui.typewrite(params.get("text",""), interval=0.03)
        return {"message": f"Typed {len(params.get('text',''))} chars"}
    except ImportError: return {"error": "pip install pyautogui"}

def _screenshot(params):
    dest = Path.home() / "Desktop" / f"orin-{int(__import__('time').time())}.png"
    try:
        import pyautogui; img = pyautogui.screenshot(); img.save(str(dest))
    except:
        try:
            if platform.system()=="Darwin": subprocess.run(["screencapture",str(dest)])
            elif platform.system()=="Windows": subprocess.run(["snippingtool","/clip"])
            else: subprocess.run(["gnome-screenshot","-f",str(dest)])
        except: return {"error": "Screenshot failed"}
    return {"message": f"Saved: {dest}", "path": str(dest)}

def _ppt(params):
    try: from pptx import Presentation; from pptx.dml.color import RGBColor; from pptx.util import Pt
    except ImportError: return {"error": "pip install python-pptx"}
    prs = Presentation()
    s1  = prs.slides.add_slide(prs.slide_layouts[0])
    s1.shapes.title.text = params.get("title","Presentation")
    if s1.placeholders[1:]: s1.placeholders[1].text = params.get("subtitle","Created by Orin AI")
    for pt in params.get("points",[]):
        s = prs.slides.add_slide(prs.slide_layouts[1])
        s.shapes.title.text = str(pt)[:80]
    dest = Path.home()/"Desktop"/f"{params.get('title','ppt')[:30]}.pptx"
    prs.save(str(dest))
    try:
        if platform.system()=="Windows": os.startfile(str(dest))
        elif platform.system()=="Darwin": subprocess.Popen(["open",str(dest)])
        else: subprocess.Popen(["xdg-open",str(dest)])
    except: pass
    return {"message": f"Created: {dest}", "path": str(dest)}

def _doc(params):
    try: from docx import Document
    except ImportError: return {"error": "pip install python-docx"}
    doc = Document(); doc.add_heading(params.get("title","Document"),0)
    doc.add_paragraph(params.get("content","Created by Orin AI"))
    dest = Path.home()/"Desktop"/f"{params.get('title','doc')[:30]}.docx"
    doc.save(str(dest))
    try:
        if platform.system()=="Windows": os.startfile(str(dest))
        elif platform.system()=="Darwin": subprocess.Popen(["open",str(dest)])
    except: pass
    return {"message": f"Created: {dest}", "path": str(dest)}

def _web(params):
    import webbrowser
    url = "https://www.google.com/search?q=" + __import__("urllib.parse",fromlist=["quote"]).parse.quote(params.get("query",""))
    webbrowser.open(url)
    return {"message": f"Searching: {params.get('query')}"}

def _spotify(params):
    try: import spotipy; from spotipy.oauth2 import SpotifyOAuth
    except ImportError: return {"error": "pip install spotipy"}
    cid = params.get("client_id", os.getenv("SPOTIFY_CLIENT_ID",""))
    csec = params.get("client_secret", os.getenv("SPOTIFY_CLIENT_SECRET",""))
    if not cid or not csec: return {"error": "Set SPOTIFY_CLIENT_ID + SPOTIFY_CLIENT_SECRET"}
    sp = spotipy.Spotify(auth_manager=SpotifyOAuth(client_id=cid, client_secret=csec,
        redirect_uri="http://localhost:8888/callback", scope="user-read-playback-state,user-modify-playback-state,user-read-currently-playing",
        cache_path=str(Path.home()/".orin_spotify")))
    action = params.get("action","status"); dev = None
    try:
        devs = sp.devices().get("devices",[]); dev = next((d for d in devs if d["is_active"]), devs[0] if devs else None)
        dev_id = dev["id"] if dev else None
    except: dev_id = None
    if action=="search_play":
        q = sp.search(params.get("query",""), type="track", limit=1); items = q["tracks"]["items"]
        if not items: return {"error": "Not found"}
        t = items[0]; sp.start_playback(device_id=dev_id, uris=[t["uri"]])
        return {"message": f"▶ {t['name']} — {t['artists'][0]['name']}"}
    elif action=="pause": sp.pause_playback(device_id=dev_id); return {"message":"⏸ Paused"}
    elif action=="play": sp.start_playback(device_id=dev_id); return {"message":"▶ Resumed"}
    elif action=="next": sp.next_track(device_id=dev_id); return {"message":"⏭ Next"}
    elif action=="prev": sp.previous_track(device_id=dev_id); return {"message":"⏮ Prev"}
    else:
        cur = sp.current_user_playing_track()
        if cur and cur["is_playing"]: t=cur["item"]; return {"message":f"▶ {t['name']} — {t['artists'][0]['name']}"}
        return {"message":"⏸ Nothing playing"}

def _custom(params):
    code = params.get("code","")
    lv = {}; exec(code, {}, lv)
    return {"message": "Done", "output": str(lv.get("result",""))}

TASKS = {
    "run_command": _shell, "open_app": _open_app, "type_text": _type_text,
    "screenshot": _screenshot, "create_ppt": _ppt, "create_doc": _doc,
    "web_search": _web, "spotify": _spotify, "custom": _custom,
    "screenshot_desktop": _screenshot, "create_file": _doc,
}
