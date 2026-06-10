import express from 'express';
const app = express();
app.use(express.json());

app.post('/webhook', (req, res) => res.sendStatus(200));
app.get('/', (req, res) => res.send('OK'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`Bot running on ${PORT}`));

// KEEP ALIVE - prevents Railway from killing container
setInterval(() => {}, 1000);
