import axios from 'axios';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdf = require('pdf-parse');

export async function extractPdfText(url: string): Promise<string> {
    try {
        console.log(`[PDF] Fetching PDF from: ${url}`);
        const response = await axios.get(url, {
            responseType: 'arraybuffer'
        });

        const dataBuffer = Buffer.from(response.data);
        const data = await pdf(dataBuffer);

        console.log(`[PDF] Extracted ${data.text.length} characters.`);

        // Return text, normalized (simple whitespace cleanup)
        return data.text.replace(/\s+/g, ' ').trim();
    } catch (error) {
        console.error(`[PDF] Error extracting text from ${url}:`, error);
        return '';
    }
}
