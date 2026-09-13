/**
 * Every amount of money the app prints, in one place.
 *
 * Dollars and cents, with thousands separated: $13,199.00. Leo, round 31 — a
 * list price is quoted to the cent, and a figure on one screen with cents and
 * the same figure on another without them reads as two different prices. The
 * item, the package total and the quote sheet all come through here, so they
 * cannot drift apart again.
 */
export const formatUSD = (usd: number) =>
  usd.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
