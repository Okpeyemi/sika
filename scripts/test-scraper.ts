import { searchSGG } from '../app/lib/scraper';

async function main() {
    const query = 'décret';
    console.log(`Searching for "${query}"...`);

    const results = await searchSGG(query);

    console.log(`Found ${results.length} results.`);
    results.forEach((r, i) => {
        console.log(`\n--- Result ${i + 1} ---`);
        console.log(`Title: ${r.title}`);
        console.log(`URL: ${r.url}`);
        console.log(`Date: ${r.date}`);
        console.log(`Summary: ${r.summary}`);
    });
}

main();
