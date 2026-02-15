
import dns from 'dns';
import net from 'net';
import tls from 'tls';

const host = 'ep-bitter-frog-a7zxak3x-pooler.ap-southeast-2.aws.neon.tech';
const port = 443;

console.log(`Resolving ${host}...`);

dns.resolve(host, (err, addresses) => {
    if (err) {
        console.error('DNS Resolution failed:', err);
        return;
    }
    console.log('DNS Addresses:', addresses);

    // Try connecting to each address
    addresses.forEach(ip => {
        console.log(`Attempting TCP connection to ${ip}:${port}...`);
        const socket = net.createConnection(port, ip, () => {
            console.log(`TCP Connected to ${ip}`);
            socket.end();
        });

        socket.on('error', (e) => {
            console.error(`TCP Connection error to ${ip}:`, e.message);
        });

        socket.setTimeout(5000, () => {
            console.error(`TCP Connection timeout to ${ip}`);
            socket.destroy();
        });
    });

    // Try TLS connection to hostname
    console.log(`Attempting TLS connection to ${host}:${port}...`);
    const socketTrace = tls.connect(port, host, { timeout: 5000 }, () => {
        console.log('TLS Connected successfully');
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
});
