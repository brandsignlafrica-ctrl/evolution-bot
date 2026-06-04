console.log("🔥 THE ENTRY FILE IS EXECUTING 🔥");

const express = require('express');
const app = express();

app.get('/', (req, res) => {
    console.log("🟢 PROXY ROUTING SUCCESSFUL - ROOT HIT");
    res.status(200).send("Railway container is alive and routing correctly.");
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
    console.log(🚀 HTTP LISTENER BOUND TO 0.0.0.0 ON PORT ${PORT});
});
