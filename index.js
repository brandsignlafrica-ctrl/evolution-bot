const express = require('express');
const app = express();

console.log("ENTRY FILE IS EXECUTING");

app.get('/', (req, res) => {
    console.log("ROOT HIT");
    res.status(200).send("Server working");
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
    console.log("SERVER STARTED ON PORT " + PORT);
});
