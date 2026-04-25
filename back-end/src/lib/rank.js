// computeRank — pure function, single source of truth for rank thresholds.
// Inputs: completedOrdersCount (non-negative integer)
// Output: one of "bronze" | "silver" | "gold" | "platinum" | "diamond"
//
// Thresholds are placeholder values — revisit once we have real data.
// Keep this as a pure function so the order controller, the backfill
// script, and any future admin tools all agree on the rank for a given
// count.
function computeRank(completedOrdersCount) {
  const n = Number(completedOrdersCount) || 0;
  if (n >= 500) return "diamond";
  if (n >= 150) return "platinum";
  if (n >= 50) return "gold";
  if (n >= 10) return "silver";
  return "bronze";
}

module.exports = { computeRank };
