import { GoogleGenerativeAI } from '@google/generative-ai';
import { SearchResult } from './scraper';

const apiKey = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey || '');

const model = genAI.getGenerativeModel({
    model: 'gemini-3-flash-preview',
    // @ts-ignore - Google Search Grounding is in beta/newer SDK versions
    tools: [{ googleSearch: {} }]
});

// Note: optimizeSearchQuery is no longer strictly needed but can still be useful.
// We keep it for now but the main magic happens in generateAnswer.

export async function optimizeSearchQuery(userQuery: string): Promise<string> {
    if (!apiKey) return userQuery;
    return userQuery;
}

export async function generateAnswer(query: string, history: string = ''): Promise<string> {
    if (!apiKey) {
        return 'Désolé, la clé API Gemini n\'est pas configurée.';
    }

    const prompt = `
Tu es un assistant intelligent pour le gouvernement du Bénin.
Ta mission : Répondre aux questions en te basant sur les documents officiels et l'historique de la conversation.

Historique de conversation :
${history}

Dernier message : "${query}"

Instructions :
1. Recherche sur le site sgg.gouv.bj pour trouver les informations officielles.
2. Utilise les résultats de recherche (Grounding) pour répondre.
3. Cite tes sources avec des liens clairs.
4. Si l'information est introuvable, dis-le poliment.
5. **IMPORTANT : Ta réponse doit être concise (max 2500 caractères) et formatée pour WhatsApp (gras, listes). Évite les longs pavés.**

Réponse :
`;

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        return await validateAndFixUrls(text);
    } catch (error) {
        console.error('Error generating answer with Gemini Grounding:', error);
        return 'Désolé, une erreur est survenue lors de la génération de la réponse.';
    }
}

export async function classifyIntent(query: string, history: string = ''): Promise<'SEARCH' | 'CHAT'> {
    if (!apiKey) return 'CHAT';

    const prompt = `
    Analyse la dernière entrée de l'utilisateur en tenant compte de l'historique de la conversation.
    Détermine si l'utilisateur a besoin d'une recherche officielle ou s'il discute.

    Règles :
    - "SEARCH" : Si l'utilisateur demande une information, un document, une actualité, ou rebondit sur un document précédent pour en savoir plus (ex: "Et celui de 2023 ?").
    - "CHAT" : Si c'est une salutation, un remerciement, ou une phrase purement sociale sans demande d'info.

    Historique de conversation :
    ${history}

    Dernier message utilisateur : "${query}"
    
    Réponse (SEARCH ou CHAT) :`;

    try {
        const result = await model.generateContent(prompt);
        const text = result.response.text().trim().toUpperCase();
        return text.includes('SEARCH') ? 'SEARCH' : 'CHAT';
    } catch (error) {
        console.error('Error classifying intent:', error);
        return 'CHAT';
    }
}

export async function generateChatResponse(query: string, history: string = ''): Promise<string> {
    if (!apiKey) return 'Bonjour ! Je suis Sika, l\'assistante du gouvernement. Je peux vous aider à trouver des documents officiels.';

    const prompt = `
    Tu es Sika, une assistante utile et courtoise pour le gouvernement du Bénin.
    Tu discutes avec un citoyen. Utilise l'historique pour maintenir le fil de la conversation.
    Réponds de manière polie, brève et naturelle.
    Si la discussion s'éternise sans but, rappelle subtilement que tu peux chercher des documents officiels.

    Historique :
    ${history}
    
    Dernier message : "${query}"
    
    Réponse :`;

    try {
        const result = await model.generateContent(prompt);
        return result.response.text();
    } catch (error) {
        console.error('Error generating chat response:', error);
        return 'Bonjour ! Comment puis-je vous aider aujourd\'hui ?';
    }
}

export async function transcribeAudio(audioBuffer: Buffer, mimeType: string): Promise<string> {
    if (!apiKey) {
        console.error('Gemini API key not configured');
        return '';
    }

    try {
        const prompt = "Transcris cet audio fidèlement. Renvoie uniquement la transcription. Si c'est vide ou inaudible, renvoie une chaîne vide.";

        const result = await model.generateContent([
            prompt,
            {
                inlineData: {
                    mimeType: mimeType,
                    data: audioBuffer.toString('base64')
                }
            }
        ]);

        const text = result.response.text();
        console.log(`Audio transcribed: "${text}"`);
        return text;
    } catch (error) {
        console.error('Error transcribing audio:', error);
        return '';
    }
}

export async function translateToFon(text: string): Promise<{ fonText: string, links: string[] }> {
    if (!apiKey) return { fonText: '', links: [] };

    // Extract links first to avoid translating them
    const links: string[] = [];
    const textWithoutLinks = text.replace(/https?:\/\/[^\s]+/g, (match) => {
        links.push(match);
        return '[LIEN]'; // Placeholder
    });

    // Also remove markdown bold/italics for cleaner TTS
    const cleanText = textWithoutLinks.replace(/\*|_/g, '');

    const prompt = `
    Traduis le texte suivant en langue Fon (Bénin).
    Le texte est une réponse officielle, sois précis mais naturel.
    Garde le placeholder '[LIEN]' tel quel s'il apparait.
    
    Texte : "${cleanText}"
    
    Traduction Fon :`;

    try {
        const result = await model.generateContent(prompt);
        let fonText = result.response.text().trim();

        // Remove [LIEN] placeholders from audio text, usually we don't speak them or say "Link available"
        fonText = fonText.replace(/\[LIEN\]/g, '');

        return { fonText, links };
    } catch (error) {
        console.error('Error translating to Fon:', error);
        return { fonText: '', links: [] };
    }
}

async function validateAndFixUrls(text: string): Promise<string> {
    const urlRegex = /https?:\/\/[^\s)]+/g;
    const matches = text.match(urlRegex) || [];

    // Deduplicate
    const uniqueUrls = [...new Set(matches)];

    for (const url of uniqueUrls) {
        try {
            // Basic cleaning: remove trailing punctuation often captured by simple regex
            let cleanUrl = url;
            if (cleanUrl.endsWith('.') || cleanUrl.endsWith(',') || cleanUrl.endsWith(')') || cleanUrl.endsWith(']')) {
                cleanUrl = cleanUrl.slice(0, -1);
            }

            // Skip validation for localhost or private IPs if desired, but here we assume public URLs

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 4000); // 4s timeout

            const response = await fetch(cleanUrl, {
                method: 'HEAD',
                signal: controller.signal,
                headers: {
                    'User-Agent': 'SikaBot/1.0',
                    'Accept': '*/*'
                }
            });
            clearTimeout(timeoutId);

            if (!response.ok) {
                // If HEAD fails (some servers block HEAD), try GET with range header or just proceed
                // But for now, mark as potentially broken if status >= 400
                if (response.status >= 400) {
                    // Escape special chars in URL for regex replacement
                    text = text.replace(new RegExp(escapeRegExp(url), 'g'), `${url} (⚠ Lien inaccessible)`);
                }
            }
        } catch (e) {
            console.warn(`URL validation failed for ${url}`);
            // Network error or timeout -> consider broken
            text = text.replace(new RegExp(escapeRegExp(url), 'g'), `${url} (⚠ Lien inaccessible)`);
        }
    }
    return text;
}

function escapeRegExp(string: string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
