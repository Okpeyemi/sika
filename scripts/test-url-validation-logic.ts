import { generateAnswer } from '../app/lib/gemini';

// Mock fetch for testing (just to see if logic holds, but we are in ts-node env, fetch is global in recent Node)
// Or we can just import the function if exported. 'validateAndFixUrls' is not exported.
// So we have to test via generateAnswer or temporarily export it.
// Actually, since generateAnswer uses it, we can mock Gemini or just check if generateAnswer calls it.
// But generateAnswer calls Google API...

// Let's modify gemini.ts to export validateAndFixUrls for testing purpose?
// Or just rely on visual inspection and maybe a manual test via curl to the endpoint with a mock?

// Alternatively, create a standalone test file with the same function logic to verify it.
// This is safer than modifying production code just for a quick test.

async function validateAndFixUrls(text: string): Promise<string> {
    const urlRegex = /https?:\/\/[^\s)]+/g;
    const matches = text.match(urlRegex) || [];
    const uniqueUrls = [...new Set(matches)]; // Dedupe

    for (const url of uniqueUrls) {
        try {
            let cleanUrl = url;
            if (cleanUrl.endsWith('.') || cleanUrl.endsWith(',') || cleanUrl.endsWith(')') || cleanUrl.endsWith(']')) {
                cleanUrl = cleanUrl.slice(0, -1);
            }

            console.log(`Checking ${cleanUrl}...`);
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 4000);

            const response = await fetch(cleanUrl, {
                method: 'HEAD',
                signal: controller.signal,
                headers: { 'User-Agent': 'SikaBot/1.0' }
            });
            clearTimeout(timeoutId);

            if (!response.ok) {
                console.log(`Failed: ${response.status}`);
                if (response.status >= 400) {
                    text = text.replace(new RegExp(escapeRegExp(url), 'g'), `${url} (⚠ Lien inaccessible)`);
                }
            } else {
                console.log(`OK: ${response.status}`);
            }
        } catch (e) {
            console.log(`Error: ${e}`);
            text = text.replace(new RegExp(escapeRegExp(url), 'g'), `${url} (⚠ Lien inaccessible)`);
        }
    }
    return text;
}

function escapeRegExp(string: string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Run test
(async () => {
    const text = "Voici un lien valide: https://google.com et un invalide: https://google.com/404page. Et un autre: https://non-existing-domain-xyz.com.";
    console.log("Original:", text);
    const result = await validateAndFixUrls(text);
    console.log("Result:", result);
})();
