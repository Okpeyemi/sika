import http from 'http';
import querystring from 'querystring';

const postData = querystring.stringify({
    'Body': 'Décret sur la sécurité',
    'From': 'whatsapp:+1234567890'
});

const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/whatsapp',
    method: 'POST',
    headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
    }
};

const req = http.request(options, (res) => {
    console.log(`STATUS: ${res.statusCode}`);
    console.log(`HEADERS: ${JSON.stringify(res.headers)}`);
    res.setEncoding('utf8');
    res.on('data', (chunk) => {
        console.log(`BODY: ${chunk}`);
    });
});

req.on('error', (e) => {
    console.error(`problem with request: ${e.message}`);
});

// Write data to request body
req.write(postData);
req.end();
