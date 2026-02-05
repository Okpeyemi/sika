import axios from 'axios';
import * as cheerio from 'cheerio';

export interface SearchResult {
    title: string;
    url: string;
    summary?: string;
    date?: string;
    type?: string;
}

const BASE_URL = 'https://sgg.gouv.bj';
const SEARCH_URL = `${BASE_URL}/recherche/`;

export async function searchSGG(query: string): Promise<SearchResult[]> {
    console.log(`[Scraper] Starting search for query: "${query}"`);
    try {
        const searchUrl = `${BASE_URL}/recherche/`;
        console.log(`[Scraper] Fetching URL: ${searchUrl} with params: { keywords: "${query}", type: "tout" }`);

        const response = await axios.get(searchUrl, {
            params: {
                keywords: query,
                type: 'tout'
            }
        });

        const $ = cheerio.load(response.data);
        const results: SearchResult[] = [];

        $('.doc-title').each((_, element) => {
            const titleLink = $(element);
            const title = titleLink.text().trim();
            const relativeUrl = titleLink.attr('href');
            const url = relativeUrl ? (relativeUrl.startsWith('http') ? relativeUrl : `${BASE_URL}${relativeUrl}`) : '';

            const container = titleLink.closest('.relative.padding-30');

            let date = '';
            let summary = '';
            let type = 'Document';

            if (container.length > 0) {
                date = container.find('.bg-white.black').text().trim() || container.find('label').first().text().trim();
                summary = container.text().replace(title, '').replace(date, '').trim().substring(0, 200) + '...';
            }

            if (title && url) {
                results.push({
                    title,
                    url,
                    date,
                    summary,
                    type
                });
            }
        });

        console.log(`[Scraper] Found ${results.length} initial results.`);

        // Limit to top 3 for deep scraping to save time/bandwidth
        const topResults = results.slice(0, 3);

        // Enrich with deep scraped content
        for (const result of topResults) {
            if (result.url) {
                console.log(`[Scraper] Deep scraping: ${result.title} (${result.url})`);
                const details = await extractDocDetails(result.url);
                if (details) {
                    result.summary = details; // Replace/Append summary with full content
                }
            }
        }

        return topResults;
    } catch (error) {
        console.error('[Scraper] Error searching SGG:', error);
        return [];
    }
}

export async function extractDocDetails(url: string): Promise<string> {
    try {
        const response = await axios.get(url);
        const $ = cheerio.load(response.data);

        // Extract main text content. 
        // .lb-parse -> often contains the full text of decrees
        // .desc -> description
        // p -> general paragraphs
        let content = $('.lb-parse').text().trim();
        if (!content) {
            content = $('.desc').text().trim();
        }
        if (!content) {
            // Fallback: grab all paragraphs in the main content area if possible
            // This is a rough heuristic
            content = $('div.content p').text().trim() || $('body').text().substring(0, 1000);
        }

        // Clean up whitespace
        content = content.replace(/\s+/g, ' ').trim();

        console.log(`[Scraper] Extracted ${content.length} characters from ${url}`);
        return content.substring(0, 2000); // Increased limit for better context
    } catch (error) {
        console.error(`[Scraper] Error extracting details from ${url}:`, error);
        return '';
    }
}
