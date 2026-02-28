import express from 'express';

const app = express();

app.get('/test', async (req, res) => {
    return Promise.reject(null);
});

app.get('/test-throw-null', async (req, res) => {
    throw null;
});

app.use((err, req, res, next) => {
    console.log("Error middleware invoked! err =", err, "typeof", typeof err, "isError", err instanceof Error);
    res.status(500).send("Error: " + err);
});

app.use((req, res, next) => {
    console.log("Normal middleware invoked! Sending 404");
    res.status(404).send("Not Found");
});

const server = app.listen(0, async () => {
    try {
        console.log("Testing reject(null)...");
        await fetch(`http://localhost:${server.address().port}/test`);
        console.log("\nTesting throw null...");
        await fetch(`http://localhost:${server.address().port}/test-throw-null`);
    } catch (e) {
        console.error("Fetch failed", e);
    }
    server.close();
});
