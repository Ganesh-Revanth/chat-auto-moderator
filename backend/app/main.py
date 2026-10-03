import os
import io
import csv
import json
from fastapi import FastAPI, File, UploadFile, HTTPException, Query, Response
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional, List, Dict, Any

from app.schemas.log import (
    LogParseResponse,
    MessageRecord,
    ModeratorActionRequest
)
from app.engine.context_analyzer import ContextAnalysisResult
from app.engine.player_profiler import PlayerProfile
from app.parsers.manager import parser_manager

app = FastAPI(
    title="Chat Log Moderation Analyzer API",
    description="Production backend API for parsing, hybrid rule+AI analysis, context threads, and moderation review.",
    version="1.0.0"
)

# Enable CORS for frontend Vite development server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ALLOWED_EXTENSIONS = {".log", ".txt", ".csv"}

@app.get("/api/v1/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "chat-log-moderation-analyzer",
        "version": "1.0.0",
        "supported_formats": ["minecraft", "discord", "generic", "csv"]
    }

@app.post("/api/v1/upload", response_model=LogParseResponse)
async def upload_chat_log(
    file: UploadFile = File(...),
    format_hint: Optional[str] = Query(None, description="Optional format override: minecraft, discord, generic, csv")
):
    filename = file.filename or "unknown.log"
    ext = os.path.splitext(filename)[1].lower()

    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file format '{ext}'. Allowed extensions are: {', '.join(sorted(ALLOWED_EXTENSIONS))}"
        )

    try:
        content_bytes = await file.read()
        content_str = content_bytes.decode("utf-8", errors="replace")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not read uploaded file: {str(e)}")

    if not content_str.strip():
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    result = parser_manager.process_file_content(
        filename=filename,
        content=content_str,
        parser_override=format_hint
    )

    # Return summary without all messages (use /api/v1/messages for paginated data)
    # messages_preview will be empty in the response – frontend fetches via /messages
    result_dict = result.model_dump()
    result_dict["messages_preview"] = []  # cleared; front-end paginates via /messages
    return result_dict

@app.get("/api/v1/messages")
async def get_messages(
    page: int = Query(1, ge=1, description="Page number (1-indexed)"),
    page_size: int = Query(200, ge=1, le=500, description="Messages per page"),
    flagged_only: bool = Query(False, description="Return only flagged messages"),
    severity: Optional[str] = Query(None, description="Filter by severity: low/medium/high/critical"),
    category: Optional[str] = Query(None, description="Filter by category"),
    player: Optional[str] = Query(None, description="Filter by player name"),
    status: Optional[str] = Query(None, description="Filter by review_status"),
    search: Optional[str] = Query(None, description="Full-text search in message/player"),
    sort_by: Optional[str] = Query("severity", description="Sort: severity, confidence, line_asc, line_desc"),
):
    """Paginated message listing with filtering and sorting."""
    msgs = parser_manager.current_messages

    # Apply filters
    if flagged_only:
        msgs = [m for m in msgs if m.is_flagged]
    if severity:
        msgs = [m for m in msgs if m.severity == severity]
    if category:
        msgs = [m for m in msgs if category in m.categories]
    if player:
        msgs = [m for m in msgs if m.player == player]
    if status:
        msgs = [m for m in msgs if m.review_status == status]
    if search:
        q = search.lower()
        msgs = [m for m in msgs if q in m.message.lower() or q in m.player.lower()]

    # Sort
    SEVERITY_RANK = {"critical": 4, "high": 3, "medium": 2, "low": 1, "none": 0}
    if sort_by == "severity":
        msgs = sorted(msgs, key=lambda m: (SEVERITY_RANK.get(m.severity, 0), m.overall_score), reverse=True)
    elif sort_by == "confidence":
        msgs = sorted(msgs, key=lambda m: m.confidence, reverse=True)
    elif sort_by == "line_desc":
        msgs = sorted(msgs, key=lambda m: m.line_number, reverse=True)
    else:  # line_asc
        msgs = sorted(msgs, key=lambda m: m.line_number)

    total = len(msgs)
    total_pages = max(1, (total + page_size - 1) // page_size)
    start = (page - 1) * page_size
    end = start + page_size
    page_msgs = msgs[start:end]

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
        "messages": [m.model_dump() for m in page_msgs],
    }

@app.get("/api/v1/sample", response_model=LogParseResponse)
async def load_sample_log():
    """Provides a realistic Minecraft server chat log for testing."""
    sample_content = """[21:14:02 INFO]: Starting minecraft server version 1.20.4
[21:14:05 INFO]: Loading properties
[21:14:10 INFO]: Done (4.812s)! For help, type "help"
[21:14:15 INFO]: Steve[/127.0.0.1:54321] logged in with entity id 120
[21:14:15 INFO]: Steve joined the game
[21:14:18 INFO]: Alex[/127.0.0.1:54322] logged in with entity id 121
[21:14:18 INFO]: Alex joined the game
[21:14:20 INFO]: [Admin] <Steve> Welcome everyone! Check your compass to locate the main fortress.
[21:14:24 INFO]: <Alex> Hey Steve! Look at all the tall green grass around spawn, looks great.
[21:14:28 INFO]: <Alex> Can anyone assist me with gathering cobblestone?
[21:14:30 INFO]: Griefer99[/127.0.0.1:54323] logged in with entity id 122
[21:14:30 INFO]: Griefer99 joined the game
[21:14:32 INFO]: <Griefer99> ez noobs
[21:14:40 INFO]: <Griefer99> Steve you are an i.d.i.o.t
[21:14:45 INFO]: <Griefer99> GIVE ME DIAMONDS RIGHT NOW OR GET WRECKED
[21:14:50 INFO]: <Alex> why are you yelling????!!!!!
[21:14:55 INFO]: <Griefer99> Join my server at 192.168.1.50:25565 or discord.gg/cheatclub
[21:15:02 INFO]: <Griefer99> kys Steve or i will leak your coords
[21:15:06 INFO]: <Griefer99> nobody wants you here, uninstall the game and delete your account
[21:15:10 INFO]: <Steve> What the fuck is wrong with this player?
[21:15:15 INFO]: Steve was slain by Griefer99
[21:15:20 INFO]: [Mod] <Alex> Reporting Griefer99 for harassment and death threats.
[21:15:25 INFO]: Steve issued server command: /mute Griefer99
"""
    return parser_manager.process_file_content("sample_minecraft.log", sample_content)

@app.get("/api/v1/messages/{msg_id}/context", response_model=ContextAnalysisResult)
async def get_message_context(msg_id: int, window: int = Query(3, ge=1, le=10)):
    """Returns preceding and succeeding messages around a specific message."""
    try:
        return parser_manager.get_message_context(msg_id, window=window)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@app.post("/api/v1/messages/{msg_id}/action", response_model=MessageRecord)
async def update_moderation_action(msg_id: int, req: ModeratorActionRequest):
    """Updates moderator disposition (confirmed, false_positive, reviewed, ignored) and notes."""
    try:
        return parser_manager.update_message_action(msg_id, req.action, req.notes)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@app.get("/api/v1/players", response_model=Dict[str, PlayerProfile])
async def get_players_profiles():
    """Returns aggregated behavioral profiles for all players."""
    return parser_manager.current_profiles

@app.get("/api/v1/players/{username}")
async def get_player_dossier(username: str):
    """Returns profile and all messages for a specific player."""
    profile = parser_manager.current_profiles.get(username)
    if not profile:
        raise HTTPException(status_code=404, detail=f"Player '{username}' not found in active dataset.")

    player_messages = [m for m in parser_manager.current_messages if m.player == username]
    return {
        "profile": profile,
        "messages": player_messages
    }

@app.get("/api/v1/analytics/summary")
async def get_analytics_summary():
    """Returns global metrics and distributions."""
    total_msgs = len(parser_manager.current_messages)
    flagged_msgs = [m for m in parser_manager.current_messages if m.is_flagged]

    reviewed_count = sum(1 for m in parser_manager.current_messages if m.review_status != "unreviewed")
    fp_count = sum(1 for m in parser_manager.current_messages if m.review_status == "false_positive")
    confirmed_count = sum(1 for m in parser_manager.current_messages if m.review_status == "confirmed")

    fp_rate = round((fp_count / reviewed_count) * 100, 1) if reviewed_count > 0 else 0.0

    return {
        "total_messages": total_msgs,
        "total_flagged": len(flagged_msgs),
        "total_players": len(parser_manager.current_profiles),
        "reviewed_count": reviewed_count,
        "confirmed_count": confirmed_count,
        "false_positive_count": fp_count,
        "false_positive_rate": fp_rate,
        "top_flagged_players": sorted(
            [p for p in parser_manager.current_profiles.values() if p.flagged_messages > 0],
            key=lambda p: p.flagged_messages,
            reverse=True
        )[:5]
    }

@app.get("/api/v1/export/report")
async def export_moderation_report(format: str = Query("json", pattern="^(json|csv)$")):
    """Exportable moderation reports as JSON or CSV."""
    if not parser_manager.current_messages:
        raise HTTPException(status_code=400, detail="No active log data to export.")

    if format == "json":
        data = {
            "summary": {
                "total_messages": len(parser_manager.current_messages),
                "total_flagged": sum(1 for m in parser_manager.current_messages if m.is_flagged),
                "players": len(parser_manager.current_profiles),
            },
            "flagged_messages": [m.model_dump() for m in parser_manager.current_messages if m.is_flagged],
            "players": {k: v.model_dump() for k, v in parser_manager.current_profiles.items()}
        }
        return Response(
            content=json.dumps(data, indent=2),
            media_type="application/json",
            headers={"Content-Disposition": "attachment; filename=moderation_report.json"}
        )
    else:  # CSV
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["Line", "Timestamp", "Player", "Message", "Severity", "Confidence", "Categories", "Review_Status", "Notes", "Reasons"])
        for m in parser_manager.current_messages:
            if m.is_flagged:
                writer.writerow([
                    m.line_number,
                    m.timestamp,
                    m.player,
                    m.message,
                    m.severity,
                    m.confidence,
                    "; ".join(m.categories),
                    m.review_status,
                    m.moderator_notes,
                    " | ".join(m.reasons)
                ])
        return Response(
            content=output.getvalue(),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=moderation_report.csv"}
        )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True)
