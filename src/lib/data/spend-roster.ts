/**
 * Deterministic seat-level spend roster.
 *
 * Stands in for the per-seat metering feed until a live billing source is wired
 * up. Deterministic so attribution, forecasting and chargeback exports are
 * stable across renders and reloads.
 */

import type { SeatSpend } from "./spend-attribution";

const FIRST = [
  "Aarav","Priya","Rohan","Meera","Kabir","Ishita","Vikram","Ananya","Arjun","Diya",
  "Kunal","Riya","Zoya","Sameer","Nisha","Devansh","Tara","Om","Sara","Yash",
  "Aditi","Neel","Kavya","Reyansh",
];
const LAST = [
  "Sharma","Patel","Iyer","Kapoor","Rao","Menon","Chatterjee","Verma","Nair","Bose",
  "Reddy","Gupta","Khan","Malhotra",
];

const TEAMS = ["Platform", "Support AI", "Research", "Finance", "Growth"] as const;

function seeded(i: number) {
  return ((i * 9301 + 49297) % 233280) / 233280;
}

export function seatRoster(teams: readonly string[] = TEAMS, count = 24): SeatSpend[] {
  const pool = teams.length > 0 ? teams : TEAMS;
  return Array.from({ length: count }, (_, i) => {
    const tokensIn = Math.round(50_000 + seeded(i + 1) * 950_000);
    const tokensOut = Math.round(20_000 + seeded(i + 2) * 400_000);
    const cost = Math.round(((tokensIn / 1000) * 0.005 + (tokensOut / 1000) * 0.015) * 100) / 100;
    return {
      id: `seat_${i}`,
      name: `${FIRST[i % FIRST.length]} ${LAST[(i * 3) % LAST.length]}`,
      team: pool[i % pool.length]!,
      cost,
    };
  });
}
