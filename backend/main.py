"""FastAPI service for Autopsy Lab incident reconstruction."""

from __future__ import annotations

import json
import os
from io import BytesIO
from pathlib import Path
from typing import Literal

import chardet
from docx import Document
from fastapi import FastAPI, File, HTTPException, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from groq import AsyncGroq
from pydantic import BaseModel, Field, ValidationError
from pypdf import PdfReader

APP_VERSION = "2.0.0"
DEFAULT_MODEL = "llama-3.3-70b-versatile"
SUPPORTED_EXTENSIONS = {".txt", ".log", ".pdf", ".docx"}
MAX_UPLOAD_BYTES = int(os.getenv("MAX_UPLOAD_BYTES", 5 * 1024 * 1024))
MAX_LOG_CHARACTERS = int(os.getenv("MAX_LOG_CHARACTERS", 30_000))


class TimelineEvent(BaseModel):
    timestamp: str = Field(description="Timestamp from the log, or 'Unknown'")
    event: str = Field(min_length=1)


class IncidentAnalysis(BaseModel):
    incident_summary: str = Field(min_length=1)
    severity: Literal["critical", "high", "medium", "low"]
    affected_component: str = Field(min_length=1)
    timeline: list[TimelineEvent] = Field(min_length=1, max_length=12)
    root_cause: str = Field(min_length=1)
    contributing_factors: list[str] = Field(default_factory=list, max_length=8)
    evidence: list[str] = Field(default_factory=list, max_length=8)
    immediate_actions: list[str] = Field(min_length=1, max_length=8)
    preventive_actions: list[str] = Field(default_factory=list, max_length=8)
    confidence_score: int = Field(ge=0, le=100)


class AnalysisMetadata(BaseModel):
    filename: str
    characters_analyzed: int
    truncated: bool
    model: str


class AnalysisResponse(BaseModel):
    analysis: IncidentAnalysis
    metadata: AnalysisMetadata


def configured_origins() -> list[str]:
    raw = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000")
    return [origin.strip() for origin in raw.split(",") if origin.strip()]


app = FastAPI(
    title="Autopsy Lab API",
    description="Converts raw logs into structured, evidence-backed incident reports.",
    version=APP_VERSION,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=configured_origins(),
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


@app.get("/")
async def root() -> dict[str, str]:
    return {
        "name": "Autopsy Lab API",
        "version": APP_VERSION,
        "docs": "/docs",
    }


@app.get("/health")
async def health() -> dict[str, str | bool]:
    return {
        "status": "ok",
        "model": os.getenv("GROQ_MODEL", DEFAULT_MODEL),
        "ai_configured": bool(os.getenv("GROQ_API_KEY")),
    }


def decode_text(contents: bytes) -> str:
    encoding = chardet.detect(contents).get("encoding") or "utf-8"
    return contents.decode(encoding, errors="replace")


def parse_document(filename: str, contents: bytes) -> str:
    extension = Path(filename).suffix.lower()
    if extension not in SUPPORTED_EXTENSIONS:
        supported = ", ".join(sorted(SUPPORTED_EXTENSIONS))
        raise ValueError(f"Unsupported file type. Supported formats: {supported}")

    if extension in {".txt", ".log"}:
        return decode_text(contents)

    if extension == ".docx":
        document = Document(BytesIO(contents))
        return "\n".join(paragraph.text for paragraph in document.paragraphs)

    reader = PdfReader(BytesIO(contents))
    return "\n".join(page.extract_text() or "" for page in reader.pages)


def clean_model_json(content: str) -> dict:
    cleaned = content.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.removeprefix("```json").removeprefix("```")
        cleaned = cleaned.removesuffix("```").strip()
    return json.loads(cleaned)


def analysis_prompt(log_data: str) -> str:
    return f"""Reconstruct the production incident represented by the logs below.

Return one valid JSON object with exactly this structure:
{{
  "incident_summary": "one concise sentence",
  "severity": "critical|high|medium|low",
  "affected_component": "service or subsystem",
  "timeline": [
    {{"timestamp": "timestamp from logs or Unknown", "event": "what happened"}}
  ],
  "root_cause": "the most likely underlying cause, clearly separated from symptoms",
  "contributing_factors": ["factor"],
  "evidence": ["short, exact signal from the supplied logs"],
  "immediate_actions": ["ordered mitigation step"],
  "preventive_actions": ["long-term prevention step"],
  "confidence_score": 0
}}

Rules:
- Base every claim on the supplied logs. Do not invent infrastructure or events.
- Use "Unknown" where the logs do not provide a timestamp or component.
- Keep evidence concise and safe to display.
- Confidence must reflect ambiguity in the evidence.
- Return JSON only, without markdown.

LOGS:
{log_data}"""


async def perform_ai_analysis(log_data: str) -> tuple[IncidentAnalysis, str]:
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="GROQ_API_KEY is not configured on the server.",
        )

    model = os.getenv("GROQ_MODEL", DEFAULT_MODEL)
    client = AsyncGroq(api_key=api_key)

    try:
        response = await client.chat.completions.create(
            model=model,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a senior site reliability engineer. "
                        "Return valid JSON and distinguish evidence from inference."
                    ),
                },
                {"role": "user", "content": analysis_prompt(log_data)},
            ],
            temperature=0.1,
            response_format={"type": "json_object"},
        )
        content = response.choices[0].message.content or "{}"
        return IncidentAnalysis.model_validate(clean_model_json(content)), model
    except (json.JSONDecodeError, ValidationError) as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="The AI response could not be validated. Please try again.",
        ) from exc
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="The AI provider could not complete the analysis.",
        ) from exc


@app.post("/analyze", response_model=AnalysisResponse)
@app.post("/analyze_logs", response_model=AnalysisResponse, include_in_schema=False)
async def analyze_logs(log_file: UploadFile = File(...)) -> AnalysisResponse:
    filename = Path(log_file.filename or "uploaded.log").name
    contents = await log_file.read(MAX_UPLOAD_BYTES + 1)

    if len(contents) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds the {MAX_UPLOAD_BYTES // (1024 * 1024)} MB limit.",
        )
    if not contents:
        raise HTTPException(status_code=400, detail="The uploaded file is empty.")

    try:
        extracted = parse_document(filename, contents).strip()
    except ValueError as exc:
        raise HTTPException(status_code=415, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=422,
            detail="The file could not be read. Confirm that it is not encrypted or corrupted.",
        ) from exc

    if not extracted:
        raise HTTPException(status_code=422, detail="No readable text was found in the file.")

    truncated = len(extracted) > MAX_LOG_CHARACTERS
    log_data = extracted[:MAX_LOG_CHARACTERS]
    analysis, model = await perform_ai_analysis(log_data)

    return AnalysisResponse(
        analysis=analysis,
        metadata=AnalysisMetadata(
            filename=filename,
            characters_analyzed=len(log_data),
            truncated=truncated,
            model=model,
        ),
    )
