import os
import copy
from datetime import datetime
from fastapi import FastAPI, Form, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import uvicorn

# --- 🚀 NEW: IMPORT PYMONGO ---
from pymongo import MongoClient

app = FastAPI()

# --- 📁 VERCEL PATH SETUP ---
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
app.mount("/static", StaticFiles(directory=os.path.join(BASE_DIR, "static")), name="static")

# --- ☁️ MONGODB CLOUD SETUP ---
# Vercel will securely inject your MongoDB URI here. 
MONGO_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
client = MongoClient(MONGO_URI)

# Connect to database named 'cricket_db' and a collection named 'match_data'
mongo_db = client["cricket_db"]
collection = mongo_db["match_data"]

# --- 💾 MONGODB DATABASE SETUP ---
def load_db():
    # Look for our single master document inside MongoDB
    data = collection.find_one({"_id": "main_data"})
    
    if not data:
        # If the database is totally empty, create the default layout and push it to Mongo
        default_data = {
            "_id": "main_data", 
            "teams": [], "matches": [], "points": [], "completed_matches": [],
            "live": {
                "title": "LIVE MATCH", "toss": "Toss: Waiting...", "venue": "Hadinaru Ground",
                "team_a": "TBA", "team_b": "TBA", "batting_team": "TBA", "bowling_team": "TBA",
                "team_a_color": "#A3E635", "team_b_color": "#3B82F6", "batting_color": "#A3E635",
                "runs": 0, "wickets": 0, "overs": "0.0", "target": 0, "recent_balls": [],
                "prev_runs": 0, "prev_wickets": 0, "prev_overs": "0.0", "total_overs": 20
            },
            "history": []
        }
        collection.insert_one(default_data)
        return default_data

    # Safety checks for existing data
    if type(data["teams"]) == list and (len(data["teams"]) == 0 or type(data["teams"][0]) == str):
        new_teams = [{"name": t, "color": "#A3E635"} for t in data["teams"]]
        data["teams"] = new_teams
    if "batting_color" not in data["live"]:
        data["live"]["batting_color"] = "#A3E635"
    if "prev_runs" not in data["live"]:
        data["live"]["prev_runs"] = 0
        data["live"]["prev_wickets"] = 0
        data["live"]["prev_overs"] = "0.0"
    if "total_overs" not in data["live"]:
        data["live"]["total_overs"] = 20
    if "completed_matches" not in data:
        data["completed_matches"] = []
    
    return data

def save_db():
    # Instantly replace the document in MongoDB with our current 'db' variable
    collection.replace_one({"_id": "main_data"}, db, upsert=True)

# Load data when app starts
db = load_db()

# --- ⚡ WEBSOCKETS (VERCEL WARNING) ---
active_connections = []

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    active_connections.append(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        active_connections.remove(websocket)

async def broadcast_update():
    for conn in active_connections:
        try: await conn.send_text("UPDATE")
        except: pass

# --- 🔒 SECURITY ROUTES ---
@app.get("/login")
def serve_login(): 
    return FileResponse(os.path.join(BASE_DIR, "templates", "login.html"))

@app.post("/api/login")
def login_attempt(password: str = Form(...)):
    if password == "SUMAN16":
        response = RedirectResponse(url="/admin", status_code=303)
        response.set_cookie(key="hcl_admin_token", value="unlocked", max_age=86400)
        return response
    return RedirectResponse(url="/login?error=1", status_code=303)

@app.get("/api/logout")
def logout():
    response = RedirectResponse(url="/login", status_code=303)
    response.delete_cookie("hcl_admin_token")
    return response

# --- PAGE ROUTES ---
@app.get("/")
def serve_index(): 
    return FileResponse(os.path.join(BASE_DIR, "templates", "index.html"))

@app.get("/admin")
def serve_admin(request: Request):
    if request.cookies.get("hcl_admin_token") != "unlocked":
        return RedirectResponse(url="/login", status_code=303)
    return FileResponse(os.path.join(BASE_DIR, "templates", "admin.html"))

# --- GET DATA ROUTES ---
@app.get("/api/match-data")
def get_match_data(): return db["live"]

@app.get("/api/teams")
def get_teams(): return db["teams"]

@app.get("/api/upcoming-matches")
def get_upcoming_matches(): return db["matches"]

@app.get("/api/points-table")
def get_points_table(): return db["points"]

@app.get("/api/completed-matches")
def get_completed_matches(): return db["completed_matches"]

# --- ADMIN API ROUTES ---
class QuickAction(BaseModel):
    runs: int
    balls: int
    wickets: int
    extras: str = ""

@app.post("/api/quick-action")
async def quick_action(action: QuickAction):
    db["history"].append(copy.deepcopy(db["live"]))
    if len(db["history"]) > 10: db["history"].pop(0)

    db["live"]["runs"] += action.runs
    db["live"]["wickets"] += action.wickets
    
    ball_label = str(action.runs)
    if action.wickets > 0: ball_label = "W"
    if action.extras != "": ball_label = action.extras

    db["live"]["recent_balls"].append(ball_label)
    if len(db["live"]["recent_balls"]) > 6: db["live"]["recent_balls"].pop(0) 

    if action.balls > 0:
        overs_split = str(float(db["live"]["overs"])).split('.')
        current_overs = int(overs_split[0])
        current_balls = int(overs_split[1])
        total_balls = (current_overs * 6) + current_balls + action.balls
        db["live"]["overs"] = f"{total_balls // 6}.{total_balls % 6}"
            
    save_db()
    await broadcast_update()
    return {"status": "success", "new_score": db["live"]}

@app.post("/api/undo")
async def undo_action():
    if len(db["history"]) > 0:
        db["live"] = db["history"].pop()
        save_db()
        await broadcast_update()
        return {"status": "success", "new_score": db["live"]}
    return {"status": "empty"}

@app.post("/api/setup-match")
async def setup_match(team_a: str = Form(...), team_b: str = Form(...), batting_team: str = Form(...), total_overs: int = Form(20), target: int = Form(0)):
    t_a_color = "#A3E635"
    t_b_color = "#3B82F6"
    for t in db["teams"]:
        if t["name"] == team_a: t_a_color = t["color"]
        if t["name"] == team_b: t_b_color = t["color"]

    db["live"]["team_a"] = team_a
    db["live"]["team_b"] = team_b
    db["live"]["team_a_color"] = t_a_color
    db["live"]["team_b_color"] = t_b_color
    db["live"]["batting_team"] = batting_team
    db["live"]["bowling_team"] = team_b if batting_team == team_a else team_a
    db["live"]["batting_color"] = t_a_color if batting_team == team_a else t_b_color
    db["live"]["total_overs"] = total_overs
    db["live"]["target"] = target
    db["live"]["runs"] = 0
    db["live"]["wickets"] = 0
    db["live"]["overs"] = "0.0"
    db["live"]["recent_balls"] = []
    
    db["live"]["prev_runs"] = 0
    db["live"]["prev_wickets"] = 0
    db["live"]["prev_overs"] = "0.0"
    
    db["history"].clear()
    save_db()
    await broadcast_update()
    return RedirectResponse(url="/admin", status_code=303)

@app.post("/api/end-innings")
async def end_innings():
    new_batting = db["live"]["bowling_team"]
    new_bowling = db["live"]["batting_team"]
    db["live"]["target"] = db["live"]["runs"] + 1
    
    db["live"]["prev_runs"] = db["live"]["runs"]
    db["live"]["prev_wickets"] = db["live"]["wickets"]
    db["live"]["prev_overs"] = db["live"]["overs"]

    db["live"]["batting_team"] = new_batting
    db["live"]["bowling_team"] = new_bowling
    db["live"]["batting_color"] = db["live"]["team_b_color"] if new_batting == db["live"]["team_b"] else db["live"]["team_a_color"]
    db["live"]["runs"] = 0
    db["live"]["wickets"] = 0
    db["live"]["overs"] = "0.0"
    db["live"]["recent_balls"] = []
    db["history"].clear()
    
    save_db()
    await broadcast_update()
    return RedirectResponse(url="/admin", status_code=303)

@app.post("/api/end-match")
async def end_match(winner: str = Form(...)):
    loser = db["live"]["team_a"] if winner == db["live"]["team_b"] else db["live"]["team_b"]
    overs_split = str(float(db["live"]["overs"])).split('.')
    total_overs = int(overs_split[0]) + (int(overs_split[1]) / 6)
    match_nrr = db["live"]["runs"] / total_overs if total_overs > 0 else 0
    
    for team in db["points"]:
        if team["team"] == winner:
            team["p"] += 1
            team["w"] += 1
            team["pts"] += 2
            team["nrr"] = f"+{match_nrr:.2f}" 
        elif team["team"] == loser:
            team["p"] += 1
            team["l"] += 1
            team["nrr"] = f"-{match_nrr:.2f}"

    current_score_str = f"{db['live']['runs']}/{db['live']['wickets']} ({db['live']['overs']} Ov)"
    prev_score_str = f"{db['live']['prev_runs']}/{db['live']['prev_wickets']} ({db['live']['prev_overs']} Ov)"

    if db["live"]["batting_team"] == db["live"]["team_a"]:
        team_a_score = current_score_str
        team_b_score = prev_score_str
    else:
        team_b_score = current_score_str
        team_a_score = prev_score_str

    date_str = datetime.now().strftime("%d %b, %Y")
    result_text = f"{winner} WON THE MATCH" if winner != "TIE" else "MATCH TIED"
    
    history_record = {
        "date": date_str,
        "team_a": db["live"]["team_a"],
        "team_b": db["live"]["team_b"],
        "team_a_score": team_a_score,
        "team_b_score": team_b_score,
        "winner": winner,
        "result": result_text
    }
    db["completed_matches"].insert(0, history_record)
            
    db["live"]["title"] = "MATCH COMPLETED"
    save_db()
    await broadcast_update()
    return RedirectResponse(url="/admin", status_code=303)

@app.post("/api/reset-live-match")
async def reset_live_match():
    db["live"] = {
        "title": "LIVE MATCH", "toss": "Toss: Waiting...", "venue": "Hadinaru Ground",
        "team_a": "TBA", "team_b": "TBA", "batting_team": "TBA", "bowling_team": "TBA",
        "team_a_color": "#A3E635", "team_b_color": "#3B82F6", "batting_color": "#A3E635",
        "runs": 0, "wickets": 0, "overs": "0.0", "target": 0, "recent_balls": [],
        "prev_runs": 0, "prev_wickets": 0, "prev_overs": "0.0", "total_overs": 20
    }
    db["history"].clear()
    save_db()
    await broadcast_update()
    return RedirectResponse(url="/admin", status_code=303)

@app.post("/api/reset-points")
async def reset_points():
    for pt in db["points"]:
        pt["p"] = 0
        pt["w"] = 0
        pt["l"] = 0
        pt["nrr"] = "0.00"
        pt["pts"] = 0
    save_db()
    await broadcast_update()
    return RedirectResponse(url="/admin", status_code=303)

@app.post("/api/delete-history")
async def delete_history(match_index: int = Form(...)):
    if 0 <= match_index < len(db["completed_matches"]):
        db["completed_matches"].pop(match_index)
        save_db()
        await broadcast_update()
    return RedirectResponse(url="/admin", status_code=303)

@app.post("/api/update-info")
async def update_info(title: str = Form(...), toss: str = Form(...), venue: str = Form(...)):
    db["live"]["title"] = title
    db["live"]["toss"] = toss
    db["live"]["venue"] = venue
    save_db()
    await broadcast_update()
    return RedirectResponse(url="/admin", status_code=303)

@app.post("/api/add-team")
def add_team(new_team: str = Form(...), team_color: str = Form(...)):
    team_clean = new_team.strip().upper()
    existing = [t["name"] for t in db["teams"]]
    if team_clean and team_clean not in existing:
        db["teams"].append({"name": team_clean, "color": team_color})
        db["points"].append({"id": len(db["teams"])-1, "team": team_clean, "p": 0, "w": 0, "l": 0, "nrr": "0.00", "pts": 0})
        save_db()
    return RedirectResponse(url="/admin", status_code=303)

@app.post("/api/delete-team")
def delete_team(team_name: str = Form(...)):
    db["teams"] = [t for t in db["teams"] if t["name"] != team_name]
    db["points"] = [pt for pt in db["points"] if pt["team"] != team_name]
    save_db()
    return RedirectResponse(url="/admin", status_code=303)

@app.post("/api/add-match")
def add_match(team_a: str = Form(...), team_b: str = Form(...), date: str = Form(...), time: str = Form(...)):
    db["matches"].append({"team_a": team_a, "team_b": team_b, "date": date, "time": time})
    save_db()
    return RedirectResponse(url="/admin", status_code=303)

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
