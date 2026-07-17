// Money helpers for DISPLAY and PREVIEW only - the backend does the authoritative
// math with BigDecimal. We calculate in CENTS (integers) because JavaScript floats
// lose cents: 0.1 + 0.2 === 0.30000000000000004
export function toCents(euro) {
  return Math.round(Number(euro || 0) * 100)
}

export function fromCents(cents) {
  return cents / 100
}

export function fmt(euroOrNull) {
  if (euroOrNull === null || euroOrNull === undefined) return '–'
  return Number(euroOrNull).toFixed(2).replace('.', ',') + ' €'
}

// Mirror of the backend's PaymentSplit.compute - used to PREVIEW the split live
// while the seller types, before anything is sent to the server.
export function previewSplit({ totalCents, cashCents, balanceCents, useBalance, keepChangeAsCredit }) {
  const paidCash = Math.min(cashCents, totalCents)
  let remaining = totalCents - paidCash
  const positiveBalance = Math.max(balanceCents, 0)
  const paidFromBalance = useBalance ? Math.min(positiveBalance, remaining) : 0
  remaining -= paidFromBalance
  const debt = remaining
  const overpaid = cashCents - paidCash
  const extraCredited = keepChangeAsCredit ? overpaid : 0
  const changeToReturn = keepChangeAsCredit ? 0 : overpaid
  return { paidCash, paidFromBalance, debt, extraCredited, changeToReturn }
}
