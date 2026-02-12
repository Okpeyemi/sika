
import dotenv from 'dotenv';
import path from 'path';
import { generateAnswer } from '../app/lib/gemini';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function testContextRetention() {
    console.log("Testing Context Retention...");

    // Turn 1: User asks about CIP
    const turn1Query = "Je veux faire mon CIP.";
    const turn1History = ""; 
    console.log(`\nTurn 1 User: "${turn1Query}"`);
    
    // We simulate the bot's response for the history of Turn 2 (to save API calls/time if we know what it likely said, 
    // but better to actually generate it to be accurate to how the system works).
    // For reproduction key, let's just use the history the user described.
    
    // Constructing history as if Turn 1 happened
    const historyAfterTurn1 = `
User: Je veux faire mon CIP.
Model: Bonjour ! Je suis Sika. Pour le CIP, voici les pièces : acte de naissance, récépissé RAVIP, attestation de résidence. Avez-vous ces documents prêts ?
`;

    // Turn 2: User says "Yes, let's verify"
    const turn2Query = "Oui vérifions ensemble.";
    console.log(`Turn 2 User: "${turn2Query}"`);
    console.log(`History provided:\n${historyAfterTurn1}`);

    try {
        // The log "[Gemini] Contextualized Query" will appear in output if successful.
        const answer = await generateAnswer(turn2Query, historyAfterTurn1);

        console.log("\n--- AI Response Turn 2 ---\n");
        console.log(answer);
        console.log("\n--------------------------\n");

        if (answer.toLowerCase().includes("passeport")) {
            console.error("❌ FAIL: Bot switched to 'Passeport' context illegally.");
        } else if (answer.toLowerCase().includes("cip") || answer.toLowerCase().includes("certificat d'identification personnelle")) {
            console.log("✅ PASS: Bot maintained 'CIP' context.");
        } else {
            console.log("⚠️ UNCLEAR: Bot did not explicitly mention CIP or Passport. Check manually.");
        }

    } catch (error) {
        console.error("Error during test:", error);
    }
}

testContextRetention();
