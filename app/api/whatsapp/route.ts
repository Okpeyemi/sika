import { NextRequest, NextResponse } from 'next/server';
import { generateAnswer, classifyIntent, generateChatResponse } from '../../lib/gemini';
import { sendWhatsAppMessage } from '../../lib/evolution';
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
