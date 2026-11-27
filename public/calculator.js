import { calculateOrder, pricing } from './order-pricing.js';

const get = (id) => document.getElementById(id);
const form = get('order-form');
const { quantity, design, includeSite } = form.elements;
const minimum = pricing.cardTiers[0].min;
const range = get('quantity-range');
const maximumLabel = get('quantity-maximum');
const error = get('quantity-error');
const hint = get('custom-hint');
const total = get('order-total');
const cardsLabel = get('cards-label');
const designLabel = get('design-label');
const cardsPrice = get('cards-price');
const designPrice = get('design-price');
const sitePrice = get('site-price');
const customPrice = get('custom-price');
const tiers = get('card-tiers');
const amounts = new Intl.NumberFormat('ru-BY', {
  style: 'currency', currency: pricing.currency, currencyDisplay: 'code', maximumFractionDigits: 0, minimumFractionDigits: 0,
});
const counts = new Intl.NumberFormat('ru-BY');
const plurals = new Intl.PluralRules('ru');
const price = (amount) => amounts.format(amount);
const designOptionPrice = (amount) => amount === 0 ? 'Бесплатно' : price(amount);
const cardWord = (quantity) => ({ one: 'карту', few: 'карты', many: 'карт', other: 'карты' })[plurals.select(quantity)];

quantity.min = minimum;
quantity.value = minimum;
range.min = minimum;
get('quantity-minimum').textContent = counts.format(minimum);
error.textContent = `Введите целое число карт от ${minimum}.`;
get('standard-price').textContent = designOptionPrice(pricing.standardDesign);
get('custom-terms').textContent = `Один макет на заказ. От ${pricing.freeCustomDesignFrom} карт индивидуальный дизайн бесплатный.`;
get('connection-price').textContent = price(pricing.siteConnection);
tiers.innerHTML = pricing.cardTiers.map(({ min, unitPrice }, index) => {
  const next = pricing.cardTiers[index + 1]?.min;
  const range = next === undefined ? `От ${counts.format(min)}`
    : next === min + 1 ? counts.format(min) : `${counts.format(min)}–${counts.format(next - 1)}`;
  return `<tr><th scope="row">${range}</th><td>${price(unitPrice)}</td></tr>`;
}).join('');

function update() {
  const count = quantity.valueAsNumber;
  const customDesign = design.value === 'custom';
  const order = calculateOrder(count, { customDesign, includeSite: includeSite.checked });

  if (order) {
    if (count > Number(range.max)) range.max = count;
    range.value = count;
    maximumLabel.textContent = counts.format(range.max);
  }
  quantity.setAttribute('aria-invalid', String(!order));
  error.hidden = !!order;
  customPrice.textContent = designOptionPrice(order && count >= pricing.freeCustomDesignFrom ? 0 : pricing.customDesign);
  const extra = order?.cardsUntilFreeDesign ?? 0;
  hint.hidden = extra === 0;
  hint.textContent = extra ? `Добавьте ещё ${extra} ${cardWord(extra)}, чтобы получить индивидуальный дизайн бесплатно.` : '';

  cardsLabel.textContent = order ? `NFC-карты · ${counts.format(count)} × ${price(order.tier.unitPrice)}` : 'NFC-карты';
  designLabel.textContent = customDesign ? 'Индивидуальный дизайн' : 'Стандартный дизайн';
  cardsPrice.textContent = order ? price(order.cards) : '—';
  designPrice.textContent = order ? price(order.design) : '—';
  sitePrice.textContent = order ? price(order.site) : '—';
  total.value = order ? price(order.total) : '—';
  pricing.cardTiers.forEach((tier, index) => {
    if (tier === order?.tier) tiers.rows[index].setAttribute('aria-current', 'true');
    else tiers.rows[index].removeAttribute('aria-current');
  });
}

form.addEventListener('input', (event) => {
  if (event.target === range) quantity.value = range.value;
  update();
});
form.addEventListener('submit', (event) => event.preventDefault());
window.addEventListener('pageshow', update);
update();
document.querySelector('.calculator-grid').hidden = false;
get('card-prices').hidden = false;
