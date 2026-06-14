from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from groq import Groq
import os
import chardet
import json

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

GROQ_API_KEY = "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"


@app.post("/analyze_logs")
async def analyze_logs(log_file: UploadFile = File(...)):
    file_extension = log_file.filename.split(".")[-1].lower()
    log_data = ""

    try:
        if file_extension == "txt":
            file_contents = await log_file.read()
            detected_encoding = chardet.detect(file_contents)["encoding"]
            if detected_encoding is None:
                detected_encoding = "utf-8"
            log_data = file_contents.decode(detected_encoding)

        elif file_extension == "docx":
            temp_filename = f"temp_{log_file.filename}"
            with open(temp_filename, "wb") as buffer:
                buffer.write(await log_file.read())
            from docx import Document
            doc = Document(temp_filename)
            log_data = "\n".join([para.text for para in doc.paragraphs])
            os.remove(temp_filename)

        elif file_extension == "pdf":
            temp_filename = f"temp_{log_file.filename}"
            with open(temp_filename, "wb") as buffer:
                buffer.write(await log_file.read())
            import PyPDF2
            with open(temp_filename, "rb") as pdf_file:
                pdf_reader = PyPDF2.PdfReader(pdf_file)
                for page in pdf_reader.pages:
                    log_data += page.extract_text() + "\n"
            os.remove(temp_filename)

        else:
            return {"error": f"Unsupported file type: {file_extension}. Please use .txt, .docx, or .pdf"}

        if not log_data.strip():
            return {"error": "The uploaded file appears to be empty."}

        analysis_results = await perform_ai_analysis(log_data)
        return {"analysis_results": analysis_results}

    except Exception as e:
        return {"error": f"An error occurred: {str(e)}"}


async def perform_ai_analysis(log_data):
    try:
        client = Groq(api_key=GROQ_API_KEY)
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {
                    "role": "system",
                    "content": "You are an expert SRE. You respond ONLY with valid JSON. No preamble, no explanation, no markdown."
                },
                {
                    "role": "user",
                    "content": f"""Analyze these logs and return ONLY a valid JSON object.
Structure:
{{
  "timeline": ["event 1", "event 2", "..."],
  "root_cause": "description of why it happened",
  "suggested_fix": "step by step fix",
  "confidence_score": 85
}}

Logs:
{log_data}"""
                }
            ],
            temperature=0.1,
        )
        content = response.choices[0].message.content.strip()
        if content.startswith("```"):
            content = content.replace("```json", "").replace("```", "").strip()
        return json.loads(content)

    except Exception as e:
        return {"error": f"AI Parsing Error: {str(e)}"}