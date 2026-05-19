"""Integration tests for POST /api/feedback (public) and GET /api/admin/feedback."""

ADMIN_HEADERS = {"X-Admin-Key": "admin-dev"}


def test_feedback_bug_report(client):
    r = client.post("/api/feedback", json={
        "email": "user@test.example", "type": "bug", "message": "Something broke",
    })
    assert r.status_code == 200
    assert r.json()["success"] is True


def test_feedback_feature_request(client):
    r = client.post("/api/feedback", json={
        "type": "feature", "message": "Please add dark mode",
    })
    assert r.status_code == 200


def test_feedback_general_no_email(client):
    r = client.post("/api/feedback", json={"type": "general", "message": "Great app!"})
    assert r.status_code == 200


def test_feedback_empty_message_400(client):
    r = client.post("/api/feedback", json={"type": "bug", "message": ""})
    assert r.status_code == 400


def test_feedback_whitespace_message_400(client):
    r = client.post("/api/feedback", json={"type": "bug", "message": "   "})
    assert r.status_code == 400


def test_feedback_appears_in_admin_inbox(client):
    unique_msg = "e2e unique feedback test message 99988877"
    client.post("/api/feedback", json={"type": "general", "message": unique_msg})

    entries = client.get("/api/admin/feedback", headers=ADMIN_HEADERS).json()
    messages = [e["message"] for e in entries]
    assert unique_msg in messages


def test_admin_feedback_descending_order(client):
    entries = client.get("/api/admin/feedback", headers=ADMIN_HEADERS).json()
    if len(entries) >= 2:
        dates = [e["created_at"] for e in entries]
        assert dates == sorted(dates, reverse=True), "Feedback must be newest first"
