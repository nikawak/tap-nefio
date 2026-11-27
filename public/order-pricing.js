export const pricing = {
  currency: 'BYN',
  cardTiers: [
    { min: 1, unitPrice: 35 },
    { min: 2, unitPrice: 30 },
    { min: 5, unitPrice: 28 },
    { min: 10, unitPrice: 25 },
    { min: 20, unitPrice: 22 },
    { min: 50, unitPrice: 20 },
  ],
  siteConnection: 30,
  standardDesign: 0,
  customDesign: 30,
  freeCustomDesignFrom: 6,
};

export function calculateOrder(quantity, { customDesign = false, includeSite = false } = {}) {
  if (!Number.isSafeInteger(quantity) || quantity < pricing.cardTiers[0].min) return null;

  const tier = pricing.cardTiers.findLast(({ min }) => quantity >= min);
  const cards = quantity * tier.unitPrice;
  const cardsUntilFreeDesign = customDesign ? Math.max(0, pricing.freeCustomDesignFrom - quantity) : 0;
  const design = customDesign ? (cardsUntilFreeDesign ? pricing.customDesign : 0) : pricing.standardDesign;
  const site = includeSite ? pricing.siteConnection : 0;
  const total = cards + design + site;
  if (!Number.isSafeInteger(total)) return null;

  return { tier, cards, design, site, total, cardsUntilFreeDesign };
}
