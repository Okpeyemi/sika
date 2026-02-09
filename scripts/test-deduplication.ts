
import axios from 'axios';

const WEBHOOK_URL = 'http://localhost:3000/api/whatsapp';

async function testDeduplication() {
    console.log('Testing Deduplication Logic...');

    const messageId = 'test_msg_id_' + Date.now();
    const payload = {
        data: {
            key: {
                remoteJid: '1234567890@s.whatsapp.net',
                fromMe: false,
                id: messageId
            },
            message: {
                conversation: 'Test message for deduplication'
            }
        }
    };

    try {
        // First request - Should succeed
        console.log(`Sending first request (ID: ${messageId})...`);
        const res1 = await axios.post(WEBHOOK_URL, payload);
        console.log('Response 1:', res1.data);

        // Second request (Duplicate) - Should be ignored
        console.log(`Sending duplicate request (ID: ${messageId})...`);
        const res2 = await axios.post(WEBHOOK_URL, payload);
        console.log('Response 2:', res2.data);

        if (res2.data.status === 'ignored_duplicate') {
            console.log('✅ SUCCESS: Duplicate message correctly ignored.');
        } else {
            console.error('❌ FAILURE: Duplicate message was NOT ignored.');
        }

    } catch (error: any) {
        console.error('Error during test:', error.response ? error.response.data : error.message);
    }
}

testDeduplication();
