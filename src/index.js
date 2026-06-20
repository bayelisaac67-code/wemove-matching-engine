require('dotenv').config();
const express = require('express');
const { findEligibleTrips } = require('./matching');
const { calculatePrice, getPriceRange } = require('./pricing');

const app = express();
app.use(express.json());

app.post('/match', async (req, res) => {
  try {
    const trips = await findEligibleTrips(req.body);
    res.json({ success: true, trips });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.post('/price', async (req, res) => {
  try {
    const price = await calculatePrice(req.body);
    res.json({ success: true, price });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.post('/price-range', async (req, res) => {
  try {
    const range = await getPriceRange(req.body);
    res.json({ success: true, range });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.get('/health', (_, res) => res.json({ status: 'ok', service: 'wemove-matching-engine' }));

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => console.log(`Matching engine on port ${PORT}`));
