import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_health_endpoint():
    res = client.get("/api/v1/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "healthy"

def test_upload_minecraft_log():
    log_content = """[21:14:00 INFO]: Starting server
[21:14:05 INFO]: Steve joined the game
[21:14:10 INFO]: <Steve> hello there!
[21:14:12 INFO]: <Alex> general kenobi
"""
    files = {"file": ("test_server.log", log_content.encode("utf-8"), "text/plain")}
    res = client.post("/api/v1/upload", files=files)
    assert res.status_code == 200
    data = res.json()
    assert data["file_name"] == "test_server.log"
    assert data["lines_processed"] == 4
    assert data["messages_detected"] == 2
    assert data["unique_players_count"] == 2
    assert "Steve" in data["unique_players"]
    assert "Alex" in data["unique_players"]
    assert len(data["messages_preview"]) == 2
    assert data["messages_preview"][0]["player"] == "Steve"
    assert data["messages_preview"][0]["message"] == "hello there!"

def test_sample_endpoint():
    res = client.get("/api/v1/sample")
    assert res.status_code == 200
    data = res.json()
    assert data["messages_detected"] > 5
    assert data["unique_players_count"] >= 3
