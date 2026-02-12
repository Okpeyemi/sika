
import dotenv from 'dotenv';
import path from 'path';
import { generateAnswer } from '../app/lib/gemini';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function testAdministrativeLogic() {
    console.log("Testing Administrative Logic...");
    
    const query = "Quelles sont les pièces à fournir pour une demande de passeport ?";
    const history = "";

    console.log(`Query: "${query}"`);

    try {
        const answer = await generateAnswer(query, history);
        console.log("\n--- AI Response ---\n");
        console.log(answer);
        console.log("\n-------------------\n");

        if (answer.toLowerCase().includes("checklist") || answer.includes("- ") || answer.includes("☐")) {
             console.log("✅ Checklist format detected.");
        } else {
             console.log("⚠️ Checklist format NOT explicitly detected (manual check required).");
        }

        if (answer.includes("prêt") || answer.includes("vérifiions") || answer.includes("disponible")) {
            console.log("✅ Readiness question detected.");
        } else {
            console.log("⚠️ Readiness question NOT detected (manual check required).");
        }

    } catch (error) {
        console.error("Error during test:", error);
    }
}

testAdministrativeLogic();
