const express = require('express');
const app = express();

app.get('/test', async (req, res) => {
  return Promise.reject(null);
});

app.use((err, req, res, next) => {
  console.log("Express error middleware caught:", err);
  console.log("Type:", typeof err);
  console.log("Is Error?", err instanceof Error);
  res.status(500).send("Error: " + err);
});

const server = app.listen(0, async () => {
    try {
        const fetch = require('node-fetch');
        await fetch(`http://localhost:${server.address().port}/test`);
    } catch (e) {
        console.error("Fetch failed", e);
    }
    server.close();
});
