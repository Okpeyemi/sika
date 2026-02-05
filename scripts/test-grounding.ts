import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// Mock history
const history = "User: Bonjour\nAssistant: Bonjour ! Je suis Sika.";

async function main() {
    const { generateAnswer } = await import('../app/lib/gemini');

    // Test 1: Grounding Search
    console.log('--- Testing Gemini Grounding ---');
    const query = "Quelle est la capitale du Bénin ?"; // Simple fact to test grounding
    console.log(`Query: "${query}"`);

    const answer = await generateAnswer(query, history);
    console.log(`\nAnswer:\n${answer}`);

    // Test 2: SGG Specific
    console.log('\n--- Testing SGG Specific Query ---');
    const sggQuery = "Code du numérique en vigueur";
    console.log(`Query: "${sggQuery}"`);

    const sggAnswer = await generateAnswer(sggQuery, history);
    console.log(`\nAnswer:\n${sggAnswer}`);
}

main();
