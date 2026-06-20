/**
 * WeMove Phase 1 Matching Engine
 * Deterministic implementation of PRD §7.2–7.6
 */

const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const WEIGHTS = {
  destination:       0.30,
  distance:          0.20,
  pickup:            0.20,
  time:              0.15,
  driverReliability: 0.10,
  passengerPriority: 0.05,
};

const TIME_TOLERANCE_MIN = parseInt(process.env.TIME_TOLERANCE_MIN || 30);

async function findEligibleTrips({ corridorId, direction, pickupPointId, dropoffPointId, desiredTime, seats, passengerId }) {
  const desired = new Date(desiredTime);
  const windowStart = new Date(desired.getTime() - TIME_TOLERANCE_MIN * 60_000);
  const windowEnd   = new Date(desired.getTime() + TIME_TOLERANCE_MIN * 60_000);

  const { rows } = await pool.query(
    `SELECT t.*,
            po.order_index  AS origin_idx,
            pd.order_index  AS dest_idx,
            pp.order_index  AS pickup_idx,
            pdr.order_index AS drop_idx,
            u.reliability_score AS driver_reliability,
            pp.lat AS pickup_lat, pp.lng AS pickup_lng
     FROM trips t
     JOIN pickup_points po  ON t.origin_point_id = po.id
     JOIN pickup_points pd  ON t.destination_point_id = pd.id
     JOIN pickup_points pp  ON pp.id = $3
     JOIN pickup_points pdr ON pdr.id = $4
     JOIN users u ON t.driver_id = u.id
     WHERE t.corridor_id = $1
       AND t.direction = $2
       AND t.status = 'PUBLISHED'
       AND t.available_seats >= $5
       AND t.departure_time BETWEEN $6 AND $7
       AND u.account_status = 'ACTIVE'
       AND u.verification_status = 'VERIFIED'`,
    [corridorId, direction, pickupPointId, dropoffPointId, seats, windowStart, windowEnd]
  );

  // Eligibility filter (PRD §7.2 rules 5 & 6)
  const eligible = rows.filter((t) =>
    t.pickup_idx >= t.origin_idx &&
    t.pickup_idx < t.dest_idx &&
    t.drop_idx > t.pickup_idx &&
    t.drop_idx <= t.dest_idx
  );

  if (!eligible.length) return [];

  const paxKm = Math.abs((eligible[0].drop_idx - eligible[0].pickup_idx) * 2.5);

  // Ranking score (PRD §7.3)
  const scored = eligible.map((t) => {
    const tripKm = Math.abs((t.dest_idx - t.origin_idx) * 2.5);
    const distSim  = 1 - Math.abs(tripKm - paxKm) / Math.max(tripKm, paxKm);
    const timeDiff = Math.abs(new Date(t.departure_time) - desired) / (TIME_TOLERANCE_MIN * 60_000);
    const timeFit  = 1 - Math.min(timeDiff, 1);
    const score =
      WEIGHTS.distance          * distSim +
      WEIGHTS.time              * timeFit +
      WEIGHTS.driverReliability * (t.driver_reliability / 100);
    return { ...t, score: parseFloat(score.toFixed(4)) };
  });

  return scored.sort((a, b) => b.score - a.score);
}

module.exports = { findEligibleTrips };
