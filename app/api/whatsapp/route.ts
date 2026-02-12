import { NextRequest, NextResponse } from 'next/server';
import { generateAnswer, classifyIntent, generateChatResponse, transcribeAudio, translateToFon, analyzeDocument } from '../../lib/gemini';
import { sendWhatsAppMessage, getMediaBase64, sendWhatsAppAudio, sendWhatsAppReaction } from '../../lib/evolution';
import { getHistory, addMessage, formatHistoryForGemini } from '../../lib/history';
import { transcribeAudioMMS, generateSpeechMMS } from '../../lib/huggingface';

const processedMessageIds = new Set<string>();

export async function POST(req: NextRequest) {
    try {
        const bodyText = await req.text();
        const payload = JSON.parse(bodyText);
        let isAudioMessage = false;

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

        // CRITICAL: Deduplication to prevent processing the same message multiple times (retries)
        const messageId = key.id || 'unknown_id';
        if (messageId && messageId !== 'unknown_id' && processedMessageIds.has(messageId)) {
            console.log(`Ignored duplicate message ID: ${messageId}`);
            return NextResponse.json({ status: 'ignored_duplicate' });
        }

        if (messageId) {
            processedMessageIds.add(messageId);
            // Simple cleanup to prevent memory leak (keep last 1000 IDs)
            if (processedMessageIds.size > 1000) {
                const iterator = processedMessageIds.values();
                for (let i = 0; i < 100; i++) {
                    const nextVal = iterator.next().value;
                    if (nextVal) processedMessageIds.delete(nextVal);
                }
            }
        }

        const from = key.remoteJid;

        let messageContent = '';
        let mediaBuffer: Buffer | null = null;
        let mediaMimeType = '';

        // Prioritize Text
        if (messageData?.conversation) {
            messageContent = messageData.conversation;
        } else if (messageData?.extendedTextMessage?.text) {
            messageContent = messageData.extendedTextMessage.text;
        } else if (data?.content) {
            messageContent = data.content;
        }

        // Handle Media (Audio, Image, Document)
        if (messageData?.audioMessage) {
            console.log('Audio message detected');
            mediaMimeType = messageData.audioMessage.mimetype || 'audio/ogg';
            const base64 = data?.base64 || messageData?.base64 || await getMediaBase64(data);
            
            if (base64) {
                mediaBuffer = Buffer.from(base64, 'base64');
                // Transcribe immediately for processing as text
                const transcription = await transcribeAudio(mediaBuffer, mediaMimeType);
                if (transcription) {
                    messageContent = transcription; // Treat as text input
                    isAudioMessage = true;
                } else {
                    messageContent = "[Audio inaudible]";
                }
            } else {
                messageContent = "[Erreur chargement audio]";
            }
        } 
        else if (messageData?.imageMessage || messageData?.documentMessage) {
            console.log('Image/Document detected');
            const msgType = messageData.imageMessage ? 'imageMessage' : 'documentMessage';
            const mediaMsg = messageData[msgType];
            
            mediaMimeType = mediaMsg.mimetype;
            // Caption usually serves as the user query
            messageContent = mediaMsg.caption || "[Document envoyé]"; 

            // Fetch Media
            const base64 = data?.base64 || mediaMsg?.base64 || await getMediaBase64(data);
            if (base64) {
                mediaBuffer = Buffer.from(base64, 'base64');
            } else {
                console.warn('Failed to fetch media base64');
            }
        }

        if ((!messageContent && !mediaBuffer) || !from) {
            return NextResponse.json({ status: 'no_content' });
        }

        console.log(`Received message from ${from}: ${messageContent}`);

        // Ack immediately - NO, we must wait in serverless or use waitUntil (middleware/edge)
        // Since we are in standard Node runtime on Vercel, we must await to ensure completion.
        // This means the webhook response will be delayed by the processing time.
        // If > 10s, WhatsApp might retry. But for now, this is the safest fix for "no response".

        try {
            // 1. Manage History
            const userId = from; // Use remoteJid as ID
            await addMessage(userId, 'user', messageContent);

            const history = await getHistory(userId);
            const formattedHistory = formatHistoryForGemini(history);

            // 2. Classify Intent / Determine Action
            // If we have a media buffer (image/doc), the intent is implicitly "ANALYZE_DOCUMENT"
            // But ensure it's not an audio file (even if transcription failed)
            let intent = 'CHAT'; 
            if (mediaBuffer && !mediaMimeType.startsWith('audio/')) {
                intent = 'ANALYZE';
            } else {
                intent = await classifyIntent(messageContent, formattedHistory);
            }
            console.log(`Intent determined: ${intent} for user ${userId}`);

            // Status Update: React to the user's message
            await sendWhatsAppReaction(from, messageId, "⏳");

            let answer = '';

            if (intent === 'ANALYZE' && mediaBuffer) {
                // Status Update: Analyzing
                await sendWhatsAppReaction(from, messageId, "🧐");
                console.log(`[Route] Analyzing document...`);
                answer = await analyzeDocument(mediaBuffer, mediaMimeType, messageContent, formattedHistory);

            } else if (intent === 'SEARCH') {
                // Status Update: Searching
                await sendWhatsAppReaction(from, messageId, "🔍");

                // 3. Generate Answer using Gemini Grounding
                console.log(`[Route] Delegating search to Gemini Grounding...`);
                answer = await generateAnswer(messageContent, formattedHistory);
            } else if (intent === 'CHAT') {
                // Status Update: Chatting
                await sendWhatsAppReaction(from, messageId, "🤖");

                // 3c. Generate Chat Response
                answer = await generateChatResponse(messageContent, formattedHistory);
            } else {
                // Fallback (should not happen if classifyIntent is exhaustive)
                answer = await generateChatResponse(messageContent, formattedHistory);
            }

            // 4. Save Bot Response
            await addMessage(userId, 'model', answer);

            // 5. Send WhatsApp response (Text or Audio) --- AUDIO PATH TO RESTORE WHEN WORKING...
            /*
            if (isAudioMessage) {
                console.log( "Audio message detected. Handling Fon translation/TTS...");

                // Status Update: Audio Generation
                await sendWhatsAppMessage(from, "⏳ ...");

                // Translate to Fon
                const { fonText, links } = await translateToFon(answer);

                if (fonText) {
                    console.log("Generating Fon TTS...");
                    const audioBuffer = await generateSpeechMMS(fonText);

                    if (audioBuffer) {
                        await sendWhatsAppAudio(from, audioBuffer);
                    } else {
                        console.warn("TTS generation failed. Sending text fallback.");
                        await sendWhatsAppMessage(from, fonText);
                    }
                } else {
                    // Translation failed, send original
                    await sendWhatsAppMessage(from, answer);
                }

                // Send links separately if any
                if (links && links.length > 0) {
                    const linksMsg = "🔗 Liens utiles :\n" + links.join("\n");
                    await sendWhatsAppMessage(from, linksMsg);
                }

            } else {
                // Standard Text Response
                await sendWhatsAppMessage(from, answer);
            }
            */

            // Temporary bypass for audio generation due to poor quality --- TO REMOVE WHEN AUDIO WORK...
            await sendWhatsAppMessage(from, answer);

            console.log(`Processing finished for ${from}`);

        } catch (error) {
            console.error('Processing error:', error);
            await sendWhatsAppMessage(from, "Désolé, une erreur technique est survenue.");
        }

        return NextResponse.json({ status: 'success' });

    } catch (error) {
        console.error('Error in WhatsApp webhook:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}


