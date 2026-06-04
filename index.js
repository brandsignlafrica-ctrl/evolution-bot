const express = require('express');
const app = express();

app.use(express.json());

console.log("🟡 Server starting...");

app.post('/webhook', (req, res) => {
    console.log("🔥 WEBHOOK HIT");
    res.sendStatus(200);
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log("🚀 SERVER STARTED");
});
