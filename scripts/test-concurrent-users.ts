
import axios from 'axios';

const WEBHOOK_URL = 'https://sika-wine.vercel.app/api/whatsapp';

const TEST_NUMBERS = [
    "22961916209",
    "22961161818",
    "22990487475"
];

const MESSAGES = [
    "Quels sont les documents pour le CIP ?",
    "Quels sont les documents pour le passeport ?",
    "Parle-moi du code du numérique au Bénin."
];

interface SuccessResult {
    number: string;
    status: 'success';
    data: any;
}

interface ErrorResult {
    number: string;
    status: 'error';
    error: any;
}

type RequestResult = SuccessResult | ErrorResult;

async function simulateRequests() {
    console.log('🚀 Starting Concurrent Request Simulation...');

    // Create an array of promises to send requests in parallel
    const requests = TEST_NUMBERS.map((number, index) => {
        const messageContent = MESSAGES[index % MESSAGES.length];
        const messageId = `sim_msg_${number}_${Date.now()}`;

        const payload = {
            data: {
                key: {
                    remoteJid: `${number}@s.whatsapp.net`,
                    fromMe: false,
                    id: messageId
                },
                message: {
                    conversation: messageContent
                },
                pushName: `User ${number}`
            }
        };

        console.log(`📤 Sending request for ${number}: "${messageContent}" (ID: ${messageId})`);

        return axios.post(WEBHOOK_URL, payload)
            .then((res): RequestResult => ({ number, status: 'success', data: res.data }))
            .catch((err): RequestResult => ({ number, status: 'error', error: err.message }));
    });

    // Wait for all requests to complete
    const results = await Promise.all(requests);

    console.log('\n📊 Simulation Results:');
    results.forEach((result: RequestResult) => {
        if (result.status === 'success') {
            console.log(`✅ ${result.number}: Success - ${JSON.stringify(result.data)}`);
        } else {
            console.error(`❌ ${result.number}: Failed - ${result.error}`);
        }
    });
}

simulateRequests();
