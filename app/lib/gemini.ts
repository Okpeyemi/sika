import { GoogleGenerativeAI } from '@google/generative-ai';
import { SearchResult } from './scraper';




// Lazy initialization function
function getModel() {
    const key = process.env.GEMINI_API_KEY;
    if (!key) return null;
    
    const genAI = new GoogleGenerativeAI(key);
    return genAI.getGenerativeModel({
        model: 'gemini-3-flash-preview',
        // @ts-ignore - Google Search Grounding is in beta/newer SDK versions
        tools: [{ googleSearch: {} }]
    });
}


// Note: optimizeSearchQuery is no longer strictly needed but can still be useful.
// We keep it for now but the main magic happens in generateAnswer.

export async function optimizeSearchQuery(userQuery: string, history: string): Promise<string> {
    const model = getModel();
    if (!model) return userQuery;

    const prompt = `
    Tu es un expert en recherche d'information.
    Ta tâche est de transformer le dernier message de l'utilisateur en une requête de recherche précise pour le site du gouvernement du Bénin, en tenant compte de l'historique.

    Historique :
    ${history}

    Dernier message : "${userQuery}"

    Règles :
    1. Si le dernier message est implicite (ex: "Oui allons-y", "C'est combien ?", "Et pour le passeport ?"), remplace-le par une requête explicite (ex: "Pièces à fournir CIP Bénin", "Coût demande passeport Bénin").
    2. Si le message est déjà précis, garde-le tel quel.
    3. RESTE CONCIS. Ne donne que la requête de recherche.

    Requête optimisée :`;

    try {
        const result = await model.generateContent(prompt);
        return result.response.text().trim();
    } catch (error) {
        console.error('Error optimizing search query:', error);
        return userQuery;
    }
}


export async function generateAnswer(query: string, history: string = ''): Promise<string> {




    // Optimize the query to be context-aware (e.g. "Oui" -> "Pièces CIP")
    const optimizedQuery = await optimizeSearchQuery(query, history);
    console.log(`[Gemini] Contextualized Query: "${query}" -> "${optimizedQuery}"`);

    const prompt = `
Tu es Sika, l'assistante officielle du gouvernement du Bénin.
Ta mission est d'aider les citoyens à comprendre les procédures administratives et à trouver les documents officiels.

Historique de conversation :
${history}

Dernier message (Contexte explicite) : "${optimizedQuery}"

Instructions :
1. Recherche sur le site sgg.gouv.bj pour trouver les informations officielles.
2. Utilise les résultats de recherche (Grounding) pour répondre.
3. **MODE ADMINISTRATIF (CRITIQUE) :**
   - Si la demande concerne une procédure (ex: demande de passeport, visa, création d'entreprise, acte de naissance, etc.) :
     a. Liste CLAIREMENT les pièces à fournir sous forme de checklist (cases à cocher).
     b. Demande explicitement à l'utilisateur : *"Avez-vous déjà ces documents prêts ?"* ou *"Voulez-vous que nous vérifiions ensemble si vous avez tout le nécessaire ?"*.
     c. Adopte un ton proactif et accompagnateur pour aider l'utilisateur à se préparer.
4. Cite tes sources avec des liens clairs vers les documents ou formulaires.
5. Si l'information est introuvable, dis-le poliment et conseille de se rapprocher de l'administration concernée.
6. **FORMAT :** Ta réponse doit être concise (max 2500 caractères) et formatée pour WhatsApp (gras, listes). Évite les longs pavés.

Réponse :
`;

    const model = getModel();
    if (!model) {
        return 'Désolé, la clé API Gemini n\'est pas configurée.';
    }

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

export async function* generateAnswerStream(query: string, history: string = '', extraInstruction: string = ''): AsyncGenerator<string> {
    const optimizedQuery = await optimizeSearchQuery(query, history);
    const prompt = `
Tu es Sika, l'assistante officielle du gouvernement du Bénin.
${extraInstruction}

Historique de conversation :
${history}

Dernier message (Contexte explicite) : "${optimizedQuery}"

Instructions :
1. Recherche sur le site sgg.gouv.bj pour trouver les informations officielles.
2. Utilise les résultats de recherche (Grounding) pour répondre.
3. Si la demande concerne une procédure, liste les pièces à fournir sous forme de checklist.
4. Cite tes sources avec des liens clairs.
5. Si l'information est introuvable, dis-le poliment.
6. Réponse concise (max 2500 caractères), formatée en Markdown.

Réponse :
`;
    const model = getModel();
    if (!model) { yield 'Désolé, la clé API Gemini n\'est pas configurée.'; return; }
    try {
        const result = await model.generateContentStream(prompt);
        for await (const chunk of result.stream) {
            const text = chunk.text();
            if (text) yield text;
        }
    } catch (error) {
        console.error('Error streaming answer:', error);
        yield 'Désolé, une erreur est survenue.';
    }
}

export async function classifyIntent(query: string, history: string = ''): Promise<'SEARCH' | 'CHAT'> {


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
        const model = getModel();
        if (!model) return 'CHAT';
        
        const result = await model.generateContent(prompt);
        const text = result.response.text().trim().toUpperCase();
        return text.includes('SEARCH') ? 'SEARCH' : 'CHAT';
    } catch (error) {
        console.error('Error classifying intent:', error);
        return 'CHAT';
    }
}

export async function generateChatResponse(query: string, history: string = ''): Promise<string> {


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
        const model = getModel();
        if (!model) return 'Bonjour ! Je suis Sika, l\'assistante du gouvernement. Je peux vous aider à trouver des documents officiels.';

        const result = await model.generateContent(prompt);
        return result.response.text();
    } catch (error) {
        console.error('Error generating chat response:', error);
        return 'Bonjour ! Comment puis-je vous aider aujourd\'hui ?';
    }
}

export async function* generateChatResponseStream(query: string, history: string = '', extraInstruction: string = ''): AsyncGenerator<string> {
    const prompt = `
    Tu es Sika, une assistante utile et courtoise pour le gouvernement du Bénin.
    ${extraInstruction}

    RÈGLE IMPORTANTE : L'historique ci-dessous est ta source de contexte principale. Si un document a été analysé dans l'historique, base tes réponses sur les informations de ce document. Ne fais PAS de recherche externe sauf si l'utilisateur le demande explicitement ou si sa question n'a aucun rapport avec le document.
    
    Historique :
    ${history}
    
    Dernier message : "${query}"
    
    Réponse :`;
    try {
        const model = getModel();
        if (!model) { yield 'Bonjour ! Comment puis-je vous aider ?'; return; }
        const result = await model.generateContentStream(prompt);
        for await (const chunk of result.stream) {
            const text = chunk.text();
            if (text) yield text;
        }
    } catch (error) {
        console.error('Error streaming chat response:', error);
        yield 'Désolé, une erreur est survenue.';
    }
}

export async function transcribeAudio(audioBuffer: Buffer, mimeType: string): Promise<string> {



    try {
        const model = getModel();
        if (!model) {
            console.error('Gemini API key not configured');
            return '';
        }

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
        const model = getModel();
        if (!model) return { fonText: '', links: [] };

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

export async function analyzeDocument(
    fileBuffer: Buffer, 
    mimeType: string, 
    userQuery: string = '', 
    history: string = ''
): Promise<string> {
    const model = getModel();
    if (!model) return "Désolé, je ne peux pas analyser ce document pour le moment (API non configurée).";

    const prompt = `
    Tu es Sika, l'assistante administrative officielle du Bénin.
    L'utilisateur t'a envoyé un document (image ou PDF) à analyser.

    Tâche :
    1. Identifie la nature du document (ex: Acte de naissance, Passeport, Formulaire, Facture, etc.).
    2. Extrais les informations clés pertinentes pour une procédure administrative (noms, dates, numéros de dossier, validité).
    3. Si l'utilisateur pose une question spécifique, réponds-y en te basant UNIQUEMENT sur le document et tes connaissances administratives.
    4. Si le document semble incomplet, flou ou non officiel, signale-le poliment.
    5. Sois rassurante et professionnelle.

    Historique de conversation (pour contexte) :
    ${history}

    Message accompagnant le document : "${userQuery}"

    Analyse et Réponse :
    `;

    try {
        const result = await model.generateContent([
            prompt,
            {
                inlineData: {
                    data: fileBuffer.toString('base64'),
                    mimeType: mimeType
                }
            }
        ]);
        return result.response.text();
    } catch (error) {
        console.error("Error analyzing document:", error);
        return "Je n'ai pas réussi à analyser ce document. Il est peut-être trop volumineux ou illisible.";
    }
}

export async function* analyzeDocumentStream(
    fileBuffer: Buffer, mimeType: string, userQuery: string = '', history: string = '', extraInstruction: string = ''
): AsyncGenerator<string> {
    const model = getModel();
    if (!model) { yield "Désolé, je ne peux pas analyser ce document (API non configurée)."; return; }
    const prompt = `
    Tu es Sika, l'assistante administrative officielle du Bénin.
    ${extraInstruction}
    L'utilisateur t'a envoyé un document à analyser.
    1. Identifie la nature du document.
    2. Extrais les informations clés.
    3. Si l'utilisateur pose une question, réponds-y.
    4. Si le document semble incomplet ou flou, signale-le.

    Historique : ${history}
    Message : "${userQuery}"
    Analyse et Réponse :
    `;
    try {
        const result = await model.generateContentStream([
            prompt,
            { inlineData: { data: fileBuffer.toString('base64'), mimeType } }
        ]);
        for await (const chunk of result.stream) {
            const text = chunk.text();
            if (text) yield text;
        }
    } catch (error) {
        console.error('Error streaming document analysis:', error);
        yield "Je n'ai pas réussi à analyser ce document.";
    }
}
