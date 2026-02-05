import { NextRequest, NextResponse } from 'next/server';
import { generateAnswer, classifyIntent, generateChatResponse } from '../../lib/gemini';
import { sendWhatsAppMessage } from '../../lib/twilio';
import { getHistory, addMessage, formatHistoryForGemini } from '../../lib/history';

export async function POST(req: NextRequest) {
    try {
        // Twilio sends data as application/x-www-form-urlencoded
        const formData = await req.formData();
        const body = formData.get('Body') as string;
        const from = formData.get('From') as string;

        if (!body || !from) {
            return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
        }

        console.log(`Received message from ${from}: ${body}`);

        // Ack the request immediately to avoid Twilio timeout
        // We will process asynchronously
        (async () => {
            try {
                // 1. Manage History
                const userId = from;
                addMessage(userId, 'user', body);

                const history = getHistory(userId);
                const formattedHistory = formatHistoryForGemini(history);

                // 2. Classify Intent
                const intent = await classifyIntent(body, formattedHistory);
                console.log(`Intent determined: ${intent} for user ${userId}`);

                let answer = '';

                if (intent === 'SEARCH') {
                    // 3. Generate Answer using Gemini Grounding
                    console.log(`[Route] Delegating search to Gemini Grounding...`);
                    answer = await generateAnswer(body, formattedHistory);
                } else {
                    // 3c. Generate Chat Response
                    answer = await generateChatResponse(body, formattedHistory);
                }

                // 4. Save Bot Response
                addMessage(userId, 'model', answer);

                // 5. Send WhatsApp response
                await sendWhatsAppMessage(from, answer);
            } catch (error) {
                console.error('Background processing error:', error);
                await sendWhatsAppMessage(from, "Désolé, une erreur technique est survenue.");
            }
        })();

        // Return TwiML or just 200 OK. 
        // Since we are messaging back asynchronously, simple 200 is fine if we don't want to reply in the same HTTP connection.
        // However, it's good practice to return empty TwiML if we don't want to reply synchronously.
        return new NextResponse('<Response></Response>', {
            headers: { 'Content-Type': 'text/xml' },
            status: 200
        });

    } catch (error) {
        console.error('Error in WhatsApp webhook:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
