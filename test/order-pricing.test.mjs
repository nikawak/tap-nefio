import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import { calculateOrder, pricing } from '../public/order-pricing.js';
import { readAssets } from '../scripts/assets.mjs';
import { createApp } from '../src/worker.js';

test('the volume price applies to every card at both ends of each tier', () => {
  const cases = [
    [1, 35], [2, 30], [4, 30], [5, 28], [6, 28], [9, 28],
    [10, 25], [19, 25], [20, 22], [49, 22], [50, 20], [51, 20], [500, 20],
  ];
  for (const [quantity, unitPrice] of cases) {
    const order = calculateOrder(quantity);
    assert.equal(order.tier.unitPrice, unitPrice, `${quantity} cards`);
    assert.equal(order.cards, quantity * unitPrice);
    assert.equal(order.total, order.cards);
    assert.equal(order.design, 0);
    assert.equal(order.site, 0);
  }
  for (const invalid of [0, -1, 1.5, '2', NaN, Infinity, Number.MAX_SAFE_INTEGER]) {
    assert.equal(calculateOrder(invalid), null);
  }
});

test('optional fees are one-time and custom design becomes free at six cards', () => {
  for (let quantity = 1; quantity <= 5; quantity += 1) {
    const order = calculateOrder(quantity, { customDesign: true });
    assert.equal(order.design, 30);
    assert.equal(order.cardsUntilFreeDesign, 6 - quantity);
    assert.equal(order.total, order.cards + 30);
  }
  const fiveWithSite = calculateOrder(5, { customDesign: true, includeSite: true });
  assert.equal(fiveWithSite.site, 30);
  assert.equal(fiveWithSite.total, 200);
  const sixWithSite = calculateOrder(6, { customDesign: true, includeSite: true });
  assert.equal(sixWithSite.design, 0);
  assert.equal(sixWithSite.cardsUntilFreeDesign, 0);
  assert.equal(sixWithSite.total, 198);
  assert.equal(calculateOrder(50, { customDesign: true }).total, 1000);
  assert.equal(calculateOrder(1, { includeSite: true }).total, 65);
});

test('the public calculator and its versioned assets work without a database or login', async () => {
  const app = createApp(readAssets());
  const request = (path, method = 'GET') => app.fetch(new Request('https://tap.example.test' + path, { method }), {});
  const response = await request('/calculator');
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /<form[^>]+id="order-form"/);
  assert.match(html, /<input[^>]+id="quantity-range"[^>]+type="range"/);
  assert.doesNotMatch(html, /id="quantity-(?:minus|plus)"/);
  const head = await request('/calculator/', 'HEAD');
  assert.equal(head.status, 200);
  assert.equal(await head.text(), '');
  assert.equal((await request('/calculator', 'POST')).status, 405);

  const modulePath = html.match(/src="(\/assets\/calculator\.js\?v=[a-f0-9]+)"/)[1];
  const moduleResponse = await request(modulePath);
  assert.match(moduleResponse.headers.get('content-type'), /javascript/);
  const pricingPath = (await moduleResponse.text()).match(/from '\.\/(order-pricing\.js\?v=[a-f0-9]+)'/)[1];
  const pricingResponse = await request('/assets/' + pricingPath);
  assert.match(pricingResponse.headers.get('content-type'), /javascript/);
  assert.match(await pricingResponse.text(), /export function calculateOrder/);
  assert.match(await (await request('/about')).text(), /href="\/calculator"/);
});

test('calculator controls update the total, active tier and design hint immediately', () => {
  class Field extends EventTarget {
    attributes = new Map();
    setAttribute(name, value) { this.attributes.set(name, value); }
    removeAttribute(name) { this.attributes.delete(name); }
    get valueAsNumber() { return this.value === '' ? NaN : Number(this.value); }
    input(target = this) {
      const event = new Event('input');
      Object.defineProperty(event, 'target', { value: target });
      this.dispatchEvent(event);
    }
  }
  const fields = new Map();
  const get = (id) => {
    if (!fields.has(id)) fields.set(id, new Field());
    return fields.get(id);
  };
  const form = get('order-form');
  const quantity = get('quantity');
  const range = get('quantity-range');
  range.max = '100';
  const design = { value: 'standard' };
  const includeSite = { checked: false };
  form.elements = { quantity, design, includeSite };
  const tierTable = get('card-tiers');
  tierTable.rows = pricing.cardTiers.map(() => new Field());
  runInNewContext(readAssets()['calculator.js'].text.replace(/^import[^\n]+/, ''), {
    calculateOrder, pricing, document: { getElementById: get, querySelector: get }, window: new EventTarget(),
  });

  const total = () => get('order-total').value.replace(/\s/g, ' ');
  assert.equal(total(), '35 BYN');
  assert.equal(Number(range.value), 1);
  assert.equal(get('custom-hint').hidden, true);

  quantity.value = '5';
  design.value = 'custom';
  includeSite.checked = true;
  form.input();
  assert.equal(total(), '200 BYN');
  assert.equal(Number(range.value), 5);
  assert.match(get('custom-hint').textContent, /ещё 1 карту/);
  assert.equal(tierTable.rows[2].attributes.get('aria-current'), 'true');
  range.value = '6';
  form.input(range);
  assert.equal(total(), '198 BYN');
  assert.equal(quantity.valueAsNumber, 6);
  assert.equal(get('custom-hint').hidden, true);
  range.value = '5';
  form.input(range);
  assert.equal(total(), '200 BYN');

  includeSite.checked = false;
  form.input();
  assert.equal(total(), '170 BYN');
  quantity.value = '150';
  form.input();
  assert.equal(Number(range.value), 150);
  assert.equal(Number(range.max), 150);
  assert.equal(get('quantity-maximum').textContent, '150');
  assert.equal(total().replace(/ /g, ''), '3000BYN');
  quantity.value = '';
  form.input();
  assert.equal(get('quantity-error').hidden, false);
  assert.equal(Number(range.value), 150);
  assert.equal(total(), '—');
});
