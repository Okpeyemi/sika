

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;
const EVOLUTION_API_TOKEN = process.env.EVOLUTION_API_TOKEN;
const EVOLUTION_INSTANCE_NAME = process.env.EVOLUTION_INSTANCE_NAME;

export async function sendWhatsAppMessage(to: string, body: string) {
    if (!EVOLUTION_API_URL || !EVOLUTION_API_TOKEN || !EVOLUTION_INSTANCE_NAME) {
        console.warn('Evolution API not configured. Message not sent.');
        return;
    }

    // Evolution API expects numbers in a specific format (usually just digits, sometimes with @s.whatsapp.net)
    // We'll strip 'whatsapp:' prefix if present (from Twilio legacy) and non-digits
    let number = to.replace('whatsapp:', '').replace(/\+/g, '').replace(/\D/g, '');

    // Check if it's a group or individual (simple heuristic, usually individual for this bot)
    // If we needed to handle remoteIds/strings exactly as they come from webhook, we might just use 'remoteJid' directly.
    // For now assuming we are replying to the 'remoteJid' we get from the webhook.

    // However, if 'to' comes from our 'from' in the webhook, it might be '123456789@s.whatsapp.net'
    // Evolution API v2 often prefers just the number for the 'number' field.
    if (to.includes('@s.whatsapp.net')) {
        number = to.split('@')[0];
    }

    const MAX_LENGTH = 1500;
    const formattedBody = formatWhatsAppResponse(body);
    const chunks = formattedBody.match(new RegExp(`.{1,${MAX_LENGTH}}`, 'g')) || [formattedBody];

    for (const chunk of chunks) {
        try {
            const endpoint = `${EVOLUTION_API_URL}/message/sendText/${EVOLUTION_INSTANCE_NAME}`;

            const payload = {
                number: number,
                text: chunk,
                delay: 1200,
                linkPreview: true
            };

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': EVOLUTION_API_TOKEN
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`Evolution API Error (${response.status}):`, errorText);
            } else {
                // console.log(`Message sent to ${number}`);
            }

            // Small delay between chunks
            await new Promise(resolve => setTimeout(resolve, 500));

        } catch (error) {
            console.error('Error sending WhatsApp message via Evolution API:', error);
        }
    }
}

export function formatWhatsAppResponse(text: string): string {
    // Re-use logic or duplicate it. Since we are migrating, it's safer to copy/own it here.
    let formatted = text;

    // 1. Convert Bold: **text** -> *text*
    formatted = formatted.replace(/\*\*(.*?)\*\*/g, '*$1*');

    // 2. Convert Bold: __text__ -> *text*
    formatted = formatted.replace(/__(.*?)__/g, '*$1*');

    // 3. Convert Headers: ### Title -> *Title*
    formatted = formatted.replace(/^###\s+(.*$)/gm, '*$1*');
    formatted = formatted.replace(/^##\s+(.*$)/gm, '*$1*');

    // 4. Convert Links: [Text](URL) -> Text: URL
    formatted = formatted.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1: $2');

    return formatted;
}

export async function getMediaBase64(message: any): Promise<string | null> {
    if (!EVOLUTION_API_URL || !EVOLUTION_API_TOKEN || !EVOLUTION_INSTANCE_NAME) {
        return null;
    }

    try {
        const endpoint = `${EVOLUTION_API_URL}/chat/getBase64FromMediaMessage/${EVOLUTION_INSTANCE_NAME}`;

        const payload = {
            message: message, // Pass the full message object from webhook
            convertToMp4: false
        };

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': EVOLUTION_API_TOKEN
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            console.error('Error fetching media base64:', await response.text());
            return null;
        }

        const data = await response.json();
        return data?.base64 || null;
    } catch (error) {
        console.error('Error in getMediaBase64:', error);
        return null;
    }
}
