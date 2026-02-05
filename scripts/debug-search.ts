import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { searchSGG } from '../app/lib/scraper';

async function main() {
    // Dynamic import to handle hoisting if necessary, though simpler here
    const { optimizeSearchQuery } = await import('../app/lib/gemini');

    const query = "Que dis l'état par rapport à la confidentialité des données utilisateurs ?";
    console.log(`Original Query: "${query}"`);

    // Test Optimization
    const optimized = await optimizeSearchQuery(query);
    console.log(`Optimized Keywords: "${optimized}"`);

    // Test Search with Optimized Query
    console.log(`\n--- Searching with Optimized Keywords ---`);
    const results = await searchSGG(optimized);
    console.log(`Found ${results.length} results.`);

    results.forEach((r, i) => {
        console.log(`\n[${i + 1}] ${r.title}\n    URL: ${r.url}`);
        if (r.summary && r.summary.length > 200) {
            console.log(`    Deep Scraped Content (Sample): ${r.summary.substring(0, 150)}...`);
        }
    });
}

main();
