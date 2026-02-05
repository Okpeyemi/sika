import twilio from 'twilio';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);

export async function sendWhatsAppMessage(to: string, body: string) {
    if (!client) {
        console.warn('Twilio client not initialized. Message not sent:', body);
        return;
    }

    const from = `whatsapp:${process.env.TWILIO_PHONE_NUMBER}`;
    const toFormatted = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;

    // Twilio limit is 1600 chars. We split into 1500 to be safe.
    const MAX_LENGTH = 1500;

    // Format Markdown to WhatsApp style
    const formattedBody = formatWhatsAppResponse(body);

    // Split message into chunks
    const chunks = formattedBody.match(new RegExp(`.{1,${MAX_LENGTH}}`, 'g')) || [formattedBody];

    let allChunksSentSuccessfully = true;

    for (const chunk of chunks) {
        try {
            await client.messages.create({
                from: from,
                to: toFormatted,
                body: chunk
            });
            // Small delay to ensure order (Twilio is usually fast/async but good practice)
            await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
            console.error('Error sending WhatsApp message chunk:', error);
            allChunksSentSuccessfully = false;
            // Don't break loop, try sending rest? Or break?
            // Usually if one fails, it's bad, but let's log and continue for robustness
        }
    }

    if (allChunksSentSuccessfully) {
        console.log(`Message (potentially chunked) sent to ${to}`);
    } else {
        console.warn(`Some chunks of the message to ${to} failed to send.`);
    }
}

export function formatWhatsAppResponse(text: string): string {
    let formatted = text;

    // 1. Convert Bold: **text** -> *text*
    formatted = formatted.replace(/\*\*(.*?)\*\*/g, '*$1*');

    // 2. Convert Bold: __text__ -> *text*
    formatted = formatted.replace(/__(.*?)__/g, '*$1*');

    // 3. Convert Headers: ### Title -> *Title*
    formatted = formatted.replace(/^###\s+(.*$)/gm, '*$1*');
    formatted = formatted.replace(/^##\s+(.*$)/gm, '*$1*');

    // 4. Convert Links: [Text](URL) -> Text: URL
    // We want to keep the text bold if possible or just clear.
    formatted = formatted.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1: $2');

    // 5. Cleanup Lists: Ensure consistency if needed, but standard markdown lists usually render okay.
    // Maybe ensure spacing?

    return formatted;
}
