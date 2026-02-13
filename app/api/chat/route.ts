import { NextRequest } from 'next/server';
import { classifyIntent, generateAnswerStream, generateChatResponseStream, analyzeDocumentStream } from '../../lib/gemini';

interface ChatMessage {
    role: 'user' | 'model';
    content: string;
}

const WEB_INSTRUCTION = `NE TE PRÉSENTE PAS à chaque message. L'utilisateur sait déjà qui tu es. Va directement à l'essentiel.
RÈGLE CRITIQUE SUR L'HISTORIQUE : L'historique de conversation est EXTRÊMEMENT important. Si un document a été analysé précédemment dans l'historique, TOUTES les questions suivantes qui font référence à ce document ou à son contenu doivent être répondues en se basant sur les informations extraites du document dans l'historique. Ne cherche sur sgg.gouv.bj QUE si l'utilisateur pose une question sans rapport avec un document soumis ou s'il demande explicitement des informations complémentaires.`;

// Detect if conversation history contains document analysis context
function historyHasDocumentContext(history: ChatMessage[]): boolean {
    return history.some(m =>
        (m.role === 'user' && (m.content.includes('📎') || m.content.includes('[Document envoyé]'))) ||
        (m.role === 'model' && (m.content.includes('document') || m.content.includes('fichier') || m.content.includes('pièce')))
    );
}

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const message = formData.get('message') as string || '';
        const historyRaw = formData.get('history') as string || '[]';
        const file = formData.get('file') as File | null;

        let history: ChatMessage[] = [];
        try {
            history = JSON.parse(historyRaw);
        } catch { /* ignore */ }

        const formattedHistory = history
            .map((m: ChatMessage) => `${m.role === 'user' ? 'Utilisateur' : 'Sika'}: ${m.content}`)
            .join('\n');

        let stream: AsyncGenerator<string>;

        if (file) {
            const arrayBuffer = await file.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            console.log(`[Chat API] Streaming document analysis: ${file.name} (${file.type})`);
            stream = analyzeDocumentStream(buffer, file.type, message || '[Document envoyé]', formattedHistory, WEB_INSTRUCTION);
        } else if (message) {
            // If there's document context in history, answer from that context
            const hasDocContext = historyHasDocumentContext(history);

            if (hasDocContext) {
                console.log(`[Chat API] Document context detected, using chat response with history`);
                stream = generateChatResponseStream(message, formattedHistory, WEB_INSTRUCTION);
            } else {
                const intent = await classifyIntent(message, formattedHistory);
                console.log(`[Chat API] Intent: ${intent}`);
                if (intent === 'SEARCH') {
                    stream = generateAnswerStream(message, formattedHistory, WEB_INSTRUCTION);
                } else {
                    stream = generateChatResponseStream(message, formattedHistory, WEB_INSTRUCTION);
                }
            }
        } else {
            return new Response(JSON.stringify({ error: 'No message or file provided' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // Create a ReadableStream from the async generator
        const readable = new ReadableStream({
            async start(controller) {
                try {
                    for await (const chunk of stream) {
                        controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ text: chunk })}\n\n`));
                    }
                    controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
                    controller.close();
                } catch (error) {
                    console.error('[Chat API] Stream error:', error);
                    controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ text: 'Erreur lors de la génération.' })}\n\n`));
                    controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
                    controller.close();
                }
            }
        });

        return new Response(readable, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
            },
        });

    } catch (error) {
        console.error('[Chat API] Error:', error);
        return new Response(JSON.stringify({ error: 'Une erreur est survenue.' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
