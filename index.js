import express from 'express';
const app = express();
app.use(express.json());

app.post('/webhook', (req, res) => {
  console.log('WEBHOOK HIT!');
  res.sendStatus(200);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`Bot running on ${PORT}`));
