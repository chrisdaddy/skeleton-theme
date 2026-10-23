// Reference implementation of the buy box figures (docs/PLAN.md §7.4), independent of
// the Liquid in snippets/offer-figure.liquid. Tests compare what the theme renders to this.
// All amounts are integer cents.

const roundCents = (hundredths) => Math.floor((Math.floor(hundredths) + 50) / 100);

// reference: 'auto' | 'compare_at' | 'singles'
export function offerFigures({ price, oneTimePrice = price, compareAt = 0, quantity = 1, servings = 0, days = 30, singlePrice = null, reference = 'auto' }) {
  const perServing = servings > 0 ? roundCents((price * 100) / (servings * quantity)) : null;
  const supplyDays = days * quantity;
  const perMonth = supplyDays > 30 ? roundCents((price * 3000) / supplyDays) : null;

  const singles = singlePrice ? singlePrice * quantity : 0;
  let ref = 0;
  if (reference === 'compare_at') ref = compareAt > price ? compareAt : 0;
  else if (reference === 'singles') ref = singles > price ? singles : 0;
  else ref = compareAt > price ? compareAt : singles > price ? singles : 0;
  if (ref === 0 && oneTimePrice > price) ref = oneTimePrice;

  return {
    total: price,
    perServing,
    perMonth,
    compare: ref > price ? ref : null,
    savePct: ref > price ? Math.floor(((ref - price) * 100) / ref) : null,
    planSavePct: oneTimePrice > price ? Math.floor(((oneTimePrice - price) * 100) / oneTimePrice) : null,
  };
}

export const formatMoney = (cents) => `$${(cents / 100).toFixed(2)}`;
