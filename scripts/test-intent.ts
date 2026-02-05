import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function main() {
    const { classifyIntent, generateChatResponse } = await import('../app/lib/gemini');

    console.log('--- Testing Intent Classification ---');

    const chatQuery = "Bonjour, ça va ?";
    const searchQuery = "Donne moi le dernier décret sur la sécurité";

    console.log(`Query: "${chatQuery}"`);
    const intent1 = await classifyIntent(chatQuery);
    console.log(`Intent: ${intent1} (Expected: CHAT)`);

    console.log(`\nQuery: "${searchQuery}"`);
    const intent2 = await classifyIntent(searchQuery);
    console.log(`Intent: ${intent2} (Expected: SEARCH)`);

    if (intent1 === 'CHAT') {
        console.log('\n--- Testing Chat Response ---');
        const response = await generateChatResponse(chatQuery);
        console.log(`Response: ${response}`);
    }
}

main();
