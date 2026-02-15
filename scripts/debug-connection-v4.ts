
import tls from 'tls';
import dns from 'dns';

// valid for Node 17+
if (dns.setDefaultResultOrder) {
    dns.setDefaultResultOrder('ipv4first');
}

const host = 'ep-bitter-frog-a7zxak3x-pooler.ap-southeast-2.aws.neon.tech';
const port = 443;

console.log(`Attempting TLS connection to ${host}:${port} with ipv4first...`);

// Explicitly asking for family: 4 as well to be sure
const socketTrace = tls.connect(port, host, { timeout: 5000, family: 4 } as any, () => {
    console.log('TLS Connected successfully with IPv4');
    console.log('Cipher:', socketTrace.getCipher());
    socketTrace.end();
});

socketTrace.on('error', (err) => {
    console.error('TLS Connection Error:', err);
});

socketTrace.on('timeout', () => {
    console.error('TLS Connection Timeout');
    socketTrace.destroy();
});
