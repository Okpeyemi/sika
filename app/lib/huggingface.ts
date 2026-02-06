
const HF_TOKEN = process.env.HUGGING_FACE_TOKEN;
const STT_MODEL = "facebook/mms-1b-all";
const TTS_MODEL = "facebook/mms-tts-fon";

export async function transcribeAudioMMS(audioBuffer: Buffer): Promise<string> {
    if (!HF_TOKEN) {
        console.warn("HUGGING_FACE_TOKEN not set. Skipping MMS transcription.");
        return "";
    }

    try {
        const response = await fetch(
            `https://api-inference.huggingface.co/models/${STT_MODEL}`,
            {
                headers: { Authorization: `Bearer ${HF_TOKEN}` },
                method: "POST",
                body: audioBuffer as any,
            }
        );

        if (!response.ok) {
            console.error(`MMS STT Error: ${response.status} ${response.statusText}`);
            return "";
        }

        const result = await response.json();
        // HF Inference API for ASR usually returns { text: "..." }
        return result.text || "";
    } catch (error) {
        console.error("Error calling MMS STT:", error);
        return "";
    }
}

const TTS_SERVER_URL = process.env.TTS_API_URL;

export async function generateSpeechMMS(text: string): Promise<Buffer | null> {
    try {
        console.log(`Generating TTS via server: ${TTS_SERVER_URL}`);

        const response = await fetch(`${TTS_SERVER_URL}/generate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: text }),
        });

        if (!response.ok) {
            console.error(`TTS Server Error: ${response.status} ${response.statusText}`);
            return null;
        }

        const data = await response.json();
        if (data && data.audio_base64) {
            return Buffer.from(data.audio_base64, 'base64');
        }
        return null;
    } catch (error) {
        console.error("Error calling TTS Server:", error);
        return null; // Ensure graceful fallback to text
    }
}
