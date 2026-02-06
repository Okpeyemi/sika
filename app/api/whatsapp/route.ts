import { NextRequest, NextResponse } from 'next/server';
import { generateAnswer, classifyIntent, generateChatResponse, transcribeAudio } from '../../lib/gemini';
import { sendWhatsAppMessage, getMediaBase64 } from '../../lib/evolution';
import { getHistory, addMessage, formatHistoryForGemini } from '../../lib/history';

export async function POST(req: NextRequest) {
    try {
        const bodyText = await req.text();
        const payload = JSON.parse(bodyText);

        // Evolution API Webhook Structure (example for messages.upsert)
        // Adjust based on your specific 'Global Webhhook' or specific event settings.
        // Usually: { type: "MESSAGE_UPSERT", data: { ... } } or just the data.

        // Log to inspect structure during dev
        // console.log('Webhook payload:', JSON.stringify(payload, null, 2));

        // Basic check for message event
        const data = payload?.data || payload; // specific to how wrapping is configured

        // Check for message upsert or similar event type
        // if (payload.event !== 'messages.upsert') return NextResponse.json({ ok: true });

        // Extract message details
        // Note: Structure largely depends on Baileys/Evolution version. 
        // Common path: data.key.remoteJid (sender), data.message.conversation (text) or data.message.extendedTextMessage.text

        const messageData = data?.message || data;
        const key = data?.key || messageData?.key;

        if (!key || key.fromMe) {
            // Ignore own messages
            return NextResponse.json({ status: 'ignored_own_message' });
        }

        const from = key.remoteJid;

        // Extract text content
        let messageContent = '';
        if (messageData?.conversation) {
            messageContent = messageData.conversation;
        } else if (messageData?.extendedTextMessage?.text) {
            messageContent = messageData.extendedTextMessage.text;
        } else if (data?.content) {
            // simplified webhook sometimes returns just content
            messageContent = data.content;
        }

        // Check for Audio/Voice Message
        if (messageData?.audioMessage) {
            console.log('Audio message detected');
            // Check for base64 payload (Evolution API often sends 'base64' if configured or we might need to fetch)
            // Assuming 'base64' or 'mediaUrl' is available. 
            // For robust handling, check your specific Evolution config (base64 in webhook = true)

            const base64Audio = data?.base64 || messageData?.base64;

            if (base64Audio) {
                const buffer = Buffer.from(base64Audio, 'base64');
                messageContent = await transcribeAudio(buffer, 'audio/ogg');
            } else {
                console.log('Base64 missing in webhook, attempting to fetch from Evolution API...');
                // Fallback: Fetch base64 using the message object
                // We pass the inner message object or the full payload depending on what the endpoint expects.
                // Usually it expects the message key and content info.
                // Let's pass the 'messageData' or 'data' appropriately.
                // If 'data' is the full message-upsert data structure, pass that? 
                // The endpoint expects { message: <The Message Object> }
                // In webhook, 'data' usually IS the message object (or data.data).

                const fetchedBase64 = await getMediaBase64(data);

                if (fetchedBase64) {
                    const buffer = Buffer.from(fetchedBase64, 'base64');
                    messageContent = await transcribeAudio(buffer, 'audio/ogg');
                } else {
                    console.warn('Failed to fetch audio base64.');
                    messageContent = "[Audio non transcrit]";
                }
            }
        }

        if (!messageContent || !from) {
            // Maybe a status update or non-text message
            return NextResponse.json({ status: 'no_text_content' });
        }

        console.log(`Received message from ${from}: ${messageContent}`);

        // Ack immediately
        (async () => {
            try {
                // 1. Manage History
                const userId = from; // Use remoteJid as ID
                addMessage(userId, 'user', messageContent);

                const history = getHistory(userId);
                const formattedHistory = formatHistoryForGemini(history);

                // 2. Classify Intent
                const intent = await classifyIntent(messageContent, formattedHistory);
                console.log(`Intent determined: ${intent} for user ${userId}`);

                let answer = '';

                if (intent === 'SEARCH') {
                    // 3. Generate Answer using Gemini Grounding
                    console.log(`[Route] Delegating search to Gemini Grounding...`);
                    answer = await generateAnswer(messageContent, formattedHistory);
                } else {
                    // 3c. Generate Chat Response
                    answer = await generateChatResponse(messageContent, formattedHistory);
                }

                // 4. Save Bot Response
                addMessage(userId, 'model', answer);

                // 5. Send WhatsApp response via Evolution API
                await sendWhatsAppMessage(from, answer);
            } catch (error) {
                console.error('Background processing error:', error);
                await sendWhatsAppMessage(from, "Désolé, une erreur technique est survenue.");
            }
        })();

        return NextResponse.json({ status: 'success' });

    } catch (error) {
        console.error('Error in WhatsApp webhook:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
