/**
 * WeMove Phase 1 Pricing Engine
 * Implements PRD §8 — floor + distance + occupancy
 */

const FLOOR_GHS  = parseFloat(process.env.FLOOR_FARE_GHS  || 10);
const PER_KM_GHS = parseFloat(process.env.PER_KM_RATE_GHS || 1.5);

// PRD §8.3 occupancy factor table (illustrative — calibrate in pilot)
const OCCUPANCY_FACTOR = { 0: 1.0, 1: 1.0, 2: 0.85, 3: 0.70, 4: 0.60 };

function getKmFromOrderIndexes(fromIdx, toIdx) {
  // 2.5 km per corridor segment — placeholder until real GPS data seeds the table
  return Math.abs(toIdx - fromIdx) * 2.5;
}

async function calculatePrice({ pickupIdx, dropoffIdx, confirmedSeats = 0 }) {
  const km     = getKmFromOrderIndexes(pickupIdx, dropoffIdx);
  const base   = Math.max(FLOOR_GHS, Math.ceil(km * PER_KM_GHS));
  const factor = OCCUPANCY_FACTOR[Math.min(confirmedSeats, 4)] ?? 0.60;
  return Math.max(FLOOR_GHS, Math.round(base * factor));
}

async function getPriceRange({ pickupIdx, dropoffIdx }) {
  const km  = getKmFromOrderIndexes(pickupIdx, dropoffIdx);
  const base = Math.max(FLOOR_GHS, Math.ceil(km * PER_KM_GHS));
  return {
    min: Math.max(FLOOR_GHS, Math.round(base * 0.60)),
    max: Math.round(base * 1.0),
    currency: 'GHS',
  };
}

module.exports = { calculatePrice, getPriceRange };
