from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from app.engine.player_profiler import PlayerProfile
from app.engine.context_analyzer import ContextAnalysisResult

class MessageRecord(BaseModel):
    id: int = Field(default=0, description="Unique 0-indexed or 1-indexed message ID")
    timestamp: str = Field(..., description="Timestamp extracted from log line")
    player: str = Field(..., description="Player username who sent the message")
    message: str = Field(..., description="Chat message body content")
    raw_line: str = Field(..., description="Original raw line from log file")
    line_number: int = Field(..., description="1-indexed line number in source file")
    # Moderation analysis fields
    is_flagged: bool = Field(default=False)
    overall_score: float = Field(default=0.0)
    rule_score: float = Field(default=0.0)
    ai_score: float = Field(default=0.0)
    severity: str = Field(default="none") # none, low, medium, high, critical
    confidence: float = Field(default=0.0)
    primary_category: str = Field(default="none")
    categories: List[str] = Field(default_factory=list)
    reasons: List[str] = Field(default_factory=list)
    ai_breakdown: Dict[str, float] = Field(default_factory=dict)
    # Moderator disposition fields
    review_status: str = Field(default="unreviewed") # unreviewed, confirmed, false_positive, ignored
    moderator_notes: str = Field(default="")

class ParseErrorRecord(BaseModel):
    line_number: int
    raw_line: str
    reason: str

class ModeratorActionRequest(BaseModel):
    action: str = Field(..., description="Action: confirmed, false_positive, reviewed, ignored")
    notes: Optional[str] = Field(default="", description="Optional moderator note")

class LogParseResponse(BaseModel):
    file_name: str
    file_size_bytes: int
    lines_processed: int
    messages_detected: int
    unique_players_count: int
    unique_players: List[str]
    detected_format: str
    parsing_errors: List[ParseErrorRecord]
    flagged_messages_count: int = 0
    critical_severity_count: int = 0
    high_severity_count: int = 0
    severity_breakdown: Dict[str, int] = Field(default_factory=dict)
    category_breakdown: Dict[str, int] = Field(default_factory=dict)
    player_profiles: Dict[str, PlayerProfile] = Field(default_factory=dict)
    messages_preview: List[MessageRecord]
