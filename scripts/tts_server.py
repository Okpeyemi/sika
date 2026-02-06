import os
import io
import base64
import torch
import scipy.io.wavfile
import numpy as np
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from transformers import VitsModel, AutoTokenizer
import uvicorn

# Initialize FastAPI
app = FastAPI(title="Sika TTS Server (Fon)")

# Load Model Global Variables
print("⏳ Loading MMS-TTS (Fon) model... This may take a moment.")
MODEL_ID = "facebook/mms-tts-fon"

try:
    tokenizer = AutoTokenizer.from_pretrained(MODEL_ID)
    model = VitsModel.from_pretrained(MODEL_ID)
    print("✅ Model loaded successfully.")
except Exception as e:
    print(f"❌ Failed to load model: {e}")
    exit(1)

class TTSRequest(BaseModel):
    text: str

@app.post("/generate")
async def generate_audio(request: TTSRequest):
    if not request.text:
        raise HTTPException(status_code=400, detail="Text is required")

    try:
        inputs = tokenizer(request.text, return_tensors="pt")
        
        with torch.no_grad():
            output = model(**inputs).waveform
        
        # Output is a tensor [1, num_samples]
        # Convert to numpy array
        audio_data = output.numpy()[0]
        
        # Create a buffer to save the WAV file
        buffer = io.BytesIO()
        
        # Scipy expects int16/32 or float32. Transformers output is float32 usually.
        # We can normalize to prevent clipping if needed, but raw output is usually fine.
        
        # Write WAV to buffer
        scipy.io.wavfile.write(buffer, rate=model.config.sampling_rate, data=audio_data)
        
        # Get base64
        buffer.seek(0)
        audio_base64 = base64.b64encode(buffer.read()).decode('utf-8')
        
        return {"audio_base64": audio_base64}

    except Exception as e:
        print(f"Error generating audio: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
def health_check():
    return {"status": "ok", "model": MODEL_ID}

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    print(f"🚀 Starting server on port {port}...")
    uvicorn.run(app, host="0.0.0.0", port=port)
