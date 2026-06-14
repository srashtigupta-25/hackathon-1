# 🔬 Autopsy Lab

> **System Failure Reconstruction Engine** - Upload a log file, get a full AI-powered post-mortem in seconds.

![Status](https://img.shields.io/badge/status-active-22c55e?style=flat-square) ![Stack](https://img.shields.io/badge/stack-Next.js%20%2B%20FastAPI-3b82f6?style=flat-square) ![AI](https://img.shields.io/badge/AI-Groq%20%2F%20LLaMA%203.3-a855f7?style=flat-square)

---

## What it does

Autopsy Lab takes raw system logs - messy, verbose, hard to read — and turns them into a structured incident report using a large language model. You upload a log file, click a button, and get back:

- **Root cause** - the actual reason things broke, not just symptoms
- **Event timeline** - a clean ordered sequence of what happened and when
- **Remediation steps** - concrete actions to fix and prevent the issue
- **Confidence score** - how certain the AI is about its analysis

Built for hackathons, on-call engineers, and anyone who has stared at a wall of stack traces at 2am.

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 (App Router, Turbopack) |
| Styling | Inline CSS, no Tailwind dependency |
| Backend | FastAPI (Python) |
| AI | Groq API — LLaMA 3.3 70B Versatile |
| File parsing | `chardet`, `PyPDF2`, `python-docx` |
| HTTP | Axios (frontend → backend) |

---

## Project structure

```
Hackathon-1/
├── frontend/               # Next.js app
│   └── src/
│       └── app/
│           └── page.js     # Main UI component
└── backend/
    ├── main.py             # FastAPI app + Groq integration
    ├── requirements.txt
    └── venv/
```

---

## Getting started

### Prerequisites

- Node.js 18+
- Python 3.10+
- A [Groq API key](https://console.groq.com) (free tier works)

### 1. Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install fastapi uvicorn groq chardet python-docx PyPDF2 python-multipart
uvicorn main:app --reload
```

Backend runs at `http://127.0.0.1:8000`

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at `http://localhost:3000`

### 3. Add your API key

In `backend/main.py`, replace the placeholder:

```python
GROQ_API_KEY = "your_groq_api_key_here"
```

Or better, use an environment variable:

```python
import os
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
```

---

## Supported log formats

| Format | Extension |
|---|---|
| Plain text | `.txt` |
| PDF | `.pdf` |
| Word document | `.docx` |

---

## How it works

```
User uploads log file
        ↓
FastAPI reads and decodes the file
        ↓
Log content sent to Groq (LLaMA 3.3 70B)
with a strict JSON-output prompt
        ↓
AI returns { timeline, root_cause,
             suggested_fix, confidence_score }
        ↓
Next.js renders the structured report
```

The backend enforces JSON-only output via a system prompt and strips any markdown fences the model accidentally adds before parsing.
<img width="1422" height="750" alt="Screenshot 2026-06-13 at 8 24 46 PM" src="https://github.com/user-attachments/assets/2a82200a-e970-43dd-84fd-a91679513d49" />


---

## API reference

### `POST /analyze_logs`

Accepts a multipart form upload.

**Request**
```
Content-Type: multipart/form-data
Body: log_file=<file>
```

**Response (success)**
```json
{
  "analysis_results": {
    "timeline": ["Application startup", "Payment service unreachable", "..."],
    "root_cause": "The payment service at payments.internal:3000 became unreachable...",
    "suggested_fix": ["Verify payment service health", "Implement circuit breaker", "..."],
    "confidence_score": 92
  }
}
```

**Response (error)**
```json
{
  "error": "Unsupported file type: csv. Please use .txt, .docx, or .pdf"
}
```

---

## Running in production

A few things to sort before deploying:

- Move the API key to an environment variable and never commit it
- Set `allow_origins` in the CORS middleware to your actual frontend domain instead of `"*"`
- Add rate limiting to the `/analyze_logs` endpoint — Groq free tier has limits
- Consider streaming the AI response for faster perceived load time on large log files

---

## Built at

This project was built during a hackathon. Fast, scrappy, and functional.
