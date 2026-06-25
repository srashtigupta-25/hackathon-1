from io import BytesIO

from docx import Document
from fastapi.testclient import TestClient

from main import app, clean_model_json, parse_document


client = TestClient(app)


def test_health_endpoint_reports_service_state():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_text_log_is_decoded():
    assert "database timeout" in parse_document("incident.log", b"database timeout")


def test_docx_is_parsed_in_memory():
    stream = BytesIO()
    document = Document()
    document.add_paragraph("payment-service unavailable")
    document.save(stream)
    assert "payment-service unavailable" in parse_document("incident.docx", stream.getvalue())


def test_unsupported_file_type_is_rejected():
    try:
        parse_document("incident.csv", b"a,b,c")
    except ValueError as exc:
        assert "Unsupported file type" in str(exc)
    else:
        raise AssertionError("Unsupported file should raise ValueError")


def test_fenced_json_is_cleaned():
    assert clean_model_json('```json\n{"severity":"high"}\n```') == {"severity": "high"}

