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
5. **IMPORTANT : Ta réponse doit être concise (max 1500 caractères) et formatée pour WhatsApp (gras, listes). Évite les longs pavés.**

Réponse :
`;

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text();
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
