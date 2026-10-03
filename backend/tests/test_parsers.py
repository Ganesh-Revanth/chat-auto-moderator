import pytest
from app.parsers.minecraft import MinecraftParser
from app.parsers.csv_parser import CSVLogParser
from app.parsers.generic import GenericTextParser
from app.parsers.manager import ParserManager

def test_minecraft_vanilla_chat():
    parser = MinecraftParser()
    line = "[21:14:32 INFO]: <Steve> ez"
    res = parser.parse_line(line, 1)
    assert res is not None
    assert res.timestamp == "21:14:32"
    assert res.player == "Steve"
    assert res.message == "ez"
    assert res.raw_line == line
    assert res.line_number == 1

def test_minecraft_paper_spigot_format():
    parser = MinecraftParser()
    line = "[21:14:32] [Server thread/INFO]: <Alex> Hello everyone!"
    res = parser.parse_line(line, 5)
    assert res is not None
    assert res.timestamp == "21:14:32"
    assert res.player == "Alex"
    assert res.message == "Hello everyone!"

def test_minecraft_prefix_cleaning():
    parser = MinecraftParser()
    line = "[21:14:32 INFO]: [Admin] <Steve> Welcome to the server"
    res = parser.parse_line(line, 10)
    assert res is not None
    assert res.player == "Steve"
    assert res.message == "Welcome to the server"

def test_minecraft_whisper():
    parser = MinecraftParser()
    line = "[21:14:32 INFO]: Steve whispers to Alex: top secret"
    res = parser.parse_line(line, 12)
    assert res is not None
    assert res.player == "Steve"
    assert res.message == "top secret"

def test_minecraft_non_chat_lines_ignored():
    parser = MinecraftParser()
    non_chat_lines = [
        "[21:14:02 INFO]: Starting minecraft server version 1.20.4",
        "[21:14:15 INFO]: Steve joined the game",
        "[21:14:15 INFO]: Steve was blown up by Creeper",
        "[21:14:40 INFO]: Steve issued server command: /help",
        "[21:14:50 INFO]: Alex left the game"
    ]
    for idx, line in enumerate(non_chat_lines, start=1):
        assert parser.parse_line(line, idx) is None

def test_csv_parser():
    parser = CSVLogParser()
    csv_content = [
        "timestamp,player,message",
        "21:14:32,Steve,ez",
        "21:14:35,Alex,gg well played"
    ]
    messages, errors = parser.parse_lines(csv_content)
    assert len(errors) == 0
    assert len(messages) == 2
    assert messages[0].player == "Steve"
    assert messages[0].message == "ez"
    assert messages[1].player == "Alex"
    assert messages[1].message == "gg well played"

def test_generic_parser():
    parser = GenericTextParser()
    line = "[10:00:15] Steve: testing generic format"
    res = parser.parse_line(line, 1)
    assert res is not None
    assert res.player == "Steve"
    assert res.message == "testing generic format"

def test_parser_manager_auto_detection():
    manager = ParserManager()
    log_content = """[21:14:02 INFO]: Starting server
[21:14:15 INFO]: Steve joined the game
[21:14:20 INFO]: <Steve> hello
[21:14:22 INFO]: <Alex> world
"""
    result = manager.process_file_content("test.log", log_content)
    assert result.file_name == "test.log"
    assert result.lines_processed == 4
    assert result.messages_detected == 2
    assert result.unique_players_count == 2
    assert sorted(result.unique_players) == ["Alex", "Steve"]
    assert len(result.parsing_errors) == 0
