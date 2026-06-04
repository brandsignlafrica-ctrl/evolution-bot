const express = require('express');
const app = express();

console.log("ENTRY FILE IS EXECUTING");

app.use(express.json());

app.get('/', (req, res) => {
    console.log("ROOT HIT");
    res.status(200).send("Server working");
});

app.get('/health', (req, res) => {
    console.log("HEALTH HIT");
    res.status(200).send("OK");
});

app.post('/webhook', (req, res) => {
    console.log("WEBHOOK RECEIVED:");
    console.log(JSON.stringify(req.body, null, 2));
    res.sendStatus(200);
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
    console.log("SERVER STARTED ON PORT " + PORT);
});
