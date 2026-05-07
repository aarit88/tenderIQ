import os
import json
import base64
import requests
from typing import List, Dict, Any
import fitz  # PyMuPDF
from ..config import settings
import PIL.Image

# Conditionally import and configure Gemini
try:
    import google.generativeai as genai
    GEMINI_AVAILABLE = True
    if settings.GEMINI_API_KEY:
        genai.configure(api_key=settings.GEMINI_API_KEY)
except ImportError:
    GEMINI_AVAILABLE = False

def extract_text_from_pdf(pdf_path: str) -> str:
    """Extracts text from a PDF file using PyMuPDF."""
    text = ""
    try:
        doc = fitz.open(pdf_path)
        for page in doc:
            text += page.get_text()
        doc.close()
    except Exception as e:
        print(f"Error extracting text from PDF: {e}")
    return text

def parse_json_response(text: str) -> Dict[str, Any]:
    json_str = text.strip()
    if "```json" in json_str:
        json_str = json_str.split("```json")[1].split("```")[0].strip()
    elif "```" in json_str:
        json_str = json_str.split("```")[1].split("```")[0].strip()
    try:
        return json.loads(json_str)
    except json.JSONDecodeError as e:
        print(f"JSON Parsing Error: {e}\nRaw Output:\n{text}")
        return {}

def call_gemini(prompt_parts: List[Any]) -> Dict[str, Any]:
    """Calls Gemini model and expects a JSON response."""
    if not GEMINI_AVAILABLE or not settings.GEMINI_API_KEY:
        raise ValueError("Gemini is not configured or missing API key.")
    
    model = genai.GenerativeModel(settings.GEMINI_MODEL)
    print("Routing request to Primary Engine (Google Gemini)...")
    response = model.generate_content(prompt_parts)
    return parse_json_response(response.text)

def call_ollama(prompt: str, model: str, images: List[str] = None) -> Dict[str, Any]:
    """Calls local Ollama model and expects a JSON response."""
    url = f"{settings.OLLAMA_HOST}/api/generate"
    payload = {
        "model": model,
        "prompt": prompt,
        "stream": False,
        "format": "json"
    }
    if images:
        payload["images"] = images
    
    print(f"Routing request to Fallback Engine (Local Ollama: {model})...")
    response = requests.post(url, json=payload, timeout=300) # Local LLMs can be slow
    response.raise_for_status()
    result = response.json()
    return json.loads(result.get("response", "{}"))

def extract_criteria_from_tender(file_path: str) -> Dict[str, Any]:
    """
    Parses a tender document and extracts eligibility criteria.
    Tries Gemini first, falls back to Ollama on failure.
    """
    text = extract_text_from_pdf(file_path)
    if not text:
        return {}

    prompt = f"""
    You are an expert CRPF Procurement Auditor. Analyze the tender and extract:
    1. ELIGIBILITY CRITERIA: Technical, Financial, Compliance. 
       - For Financial: Look for "Average Annual Turnover" requirements.
    2. DOCUMENT CHECKLIST: List every mandatory certification or document requested (e.g., GST, ISO 9001, PAN, MSME, Experience Certificate).

    Return ONLY JSON with this format:
    {{
      "criteria": [
        {{"category": "Financial", "name": "Avg Turnover", "threshold": "> ₹5 Cr (3yr Avg)", "mandatory": true, "source_page": 1, "source_text": "..."}}
      ],
      "required_docs": ["GST Registration", "ISO 9001:2015", "Audited Balance Sheets (3 yrs)"]
    }}

    TENDER TEXT:
    {text}
    """
    
    try:
        return call_gemini([prompt])
    except Exception as e:
        print(f"Primary Engine (Gemini) Failed: {e}")
        try:
            return call_ollama(prompt, settings.OLLAMA_TEXT_MODEL)
        except Exception as ollama_error:
            print(f"Fallback Engine (Ollama) Failed: {ollama_error}")
            return {}

def evaluate_bidder_against_criteria(bidder_files: List[str], criteria: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Evaluates a bidder's documents against tender criteria.
    Tries Gemini (multimodal) first, falls back to Ollama (vision/text) on failure.
    """
    criteria_json = json.dumps(criteria)
    
    base_prompt = f"You are an expert procurement auditor. Evaluate the following bidder documents against the specified criteria.\n\nCRITERIA TO CHECK:\n{criteria_json}\n\nBIDDER DOCUMENTS:"
    
    gemini_parts = [base_prompt]
    ollama_prompt = base_prompt
    ollama_images_base64 = []
    has_images = False
    
    for file_path in bidder_files:
        ext = file_path.lower().split('.')[-1]
        if ext == 'pdf':
            text = extract_text_from_pdf(file_path)
            gemini_parts.append(f"\n--- PDF DOCUMENT: {os.path.basename(file_path)} ---\n{text}")
            ollama_prompt += f"\n--- PDF DOCUMENT: {os.path.basename(file_path)} ---\n{text}"
        elif ext in ['jpg', 'jpeg', 'png']:
            try:
                has_images = True
                img = PIL.Image.open(file_path)
                gemini_parts.append(f"\n--- IMAGE DOCUMENT: {os.path.basename(file_path)} ---")
                gemini_parts.append(img)
                
                ollama_prompt += f"\n--- IMAGE DOCUMENT: {os.path.basename(file_path)} (See attached base64 image) ---"
                with open(file_path, "rb") as image_file:
                    encoded_string = base64.b64encode(image_file.read()).decode('utf-8')
                    ollama_images_base64.append(encoded_string)
            except Exception as e:
                print(f"Error loading image {file_path}: {e}")
        else:
            skipped_msg = f"\n--- FILE: {os.path.basename(file_path)} (Skipped extraction) ---"
            gemini_parts.append(skipped_msg)
            ollama_prompt += skipped_msg

    prompt_suffix = """
    For each criterion, decide if the bidder is: 'eligible', 'ineligible', or 'review'.
    
    SPECIAL LOGIC:
    - FINANCIAL AVERAGING: If the threshold is an average (e.g. 3 years), extract the value for each of the 3 years and calculate the average yourself. Show this calculation in the reasoning.
    - AMBIGUITY: If you choose 'review', explicitly state IF it's due to 'Image Quality', 'Missing Evidence', or 'Conflicting Information'.
    
    DOCUMENT CHECKLIST:
    - Based on the BIDDER DOCUMENTS, check if each item in the 'required_docs' list is present.
    
    Return ONLY a JSON object:
    {
      "evaluations": [
         {
           "criterion_id": "...", 
           "verdict": "...", 
           "reasoning": "[Show Calc/Evidence]", 
           "extracted_value": "...", 
           "confidence": "high/medium/low", 
           "source_page": 1,
           "source_document": "[Filename]",
           "evidence_snippet": "[The exact text snippet found]",
           "action_required": "[Specific next step for human if verdict is 'review']"
         }
      ],
      "checklist": {
         "Document Name": "found" / "missing"
      }
    }
    """
    gemini_parts.append(prompt_suffix)
    ollama_prompt += prompt_suffix
    
    try:
        return call_gemini(gemini_parts)
    except Exception as e:
        print(f"Primary Engine (Gemini) Failed: {e}")
        try:
            model_to_use = settings.OLLAMA_VISION_MODEL if has_images else settings.OLLAMA_TEXT_MODEL
            return call_ollama(ollama_prompt, model_to_use, ollama_images_base64 if has_images else None)
        except Exception as ollama_error:
            print(f"Fallback Engine (Ollama) Failed: {ollama_error}")
            return {}
