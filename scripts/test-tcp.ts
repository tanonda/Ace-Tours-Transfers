import net from 'net';

const host = 'ep-bitter-frog-a7zxak3x-pooler.ap-southeast-2.aws.neon.tech';
const port = 5432;

console.log(`Connecting to ${host}:${port}...`);

const socket = net.connect(port, host, () => {
    console.log('✅ TCP Connection successful!');
    socket.end();
    process.exit(0);
});

socket.on('error', (err) => {
    console.error('❌ TCP Connection failed!');
    console.error(err);
    process.exit(1);
});

socket.setTimeout(5000, () => {
    console.error('❌ TCP Connection timed out!');
    socket.destroy();
    process.exit(1);
});
