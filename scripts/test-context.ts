import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// Mock history for testing if needed, or use the real one
// We will use the functions from gemini.ts directly, manually passing history strings
// to verify the PROMPTS work as expected.
// The integration test would be harder without spinning up the server, 
// so unit testing the prompts is the best first step.

async function main() {
    const { classifyIntent, generateChatResponse, generateAnswer } = await import('../app/lib/gemini');

    console.log('--- Testing Context Awareness ---');

    // Scenario 1: Greeting
    const history1 = '';
    const query1 = "Bonjour Sika !";
    const intent1 = await classifyIntent(query1, history1);
    console.log(`\n1. User: "${query1}"\n   History: [Empty]\n   Intent: ${intent1} (Expected: CHAT)`);

    const response1 = await generateChatResponse(query1, history1);
    // Simulate adding to history
    const history2 = `User: ${query1}\nAssistant: ${response1}`;

    // Scenario 2: Contextual Follow-up
    // Let's pretend previous exchange was about a decree
    const historyContext = `User: Donne moi le décret sur la sécurité.\nAssistant: Voici le décret 2024-001 sur la sécurité...`;

    const query2 = "Et celui de 2023 ?";
    const intent2 = await classifyIntent(query2, historyContext);
    console.log(`\n2. User: "${query2}"\n   History: "${historyContext.replace(/\n/g, ' | ')}"\n   Intent: ${intent2} (Expected: SEARCH)`);

    // Scenario 3: Chat in context
    const query3 = "Merci, c'est gentil.";
    const intent3 = await classifyIntent(query3, historyContext);
    console.log(`\n3. User: "${query3}"\n   History: "${historyContext.replace(/\n/g, ' | ')}"\n   Intent: ${intent3} (Expected: CHAT)`);
}

main();
