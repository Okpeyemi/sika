import { formatWhatsAppResponse } from '../app/lib/twilio';

console.log('--- Testing WhatsApp Formatter ---');

const inputs = [
    'This is **bold** text.',
    'This is __bold__ text.',
    '### Header 1',
    '## Header 2',
    'Check this [Link](https://google.com).',
    'Mixed **bold** and [link](http://test.com).'
];

inputs.forEach(input => {
    console.log(`\nInput:  ${input}`);
    console.log(`Output: ${formatWhatsAppResponse(input)}`);
});
