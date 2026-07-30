import assert from 'node:assert/strict';
import test from 'node:test';
import {
  normalizeAmazonUrl,
  normalizeAmazonUrls,
  sanitizeAmazonMarketplaceText,
} from './amazonScrape.js';

test('normalizes tracked Amazon links to a stable product URL', () => {
  assert.equal(
    normalizeAmazonUrl('https://www.amazon.com/gp/product/B0ABCDEFGH?ref_=abc&th=1'),
    'https://www.amazon.com/dp/B0ABCDEFGH',
  );
});

test('extracts up to four unique Amazon product links in order', () => {
  assert.deepEqual(
    normalizeAmazonUrls(`
      https://www.amazon.com/dp/B0ABCDEFGH?ref_=one
      https://www.amazon.fr/gp/product/B0ABCDEFGI
      https://www.amazon.com/dp/B0ABCDEFGH?ref_=duplicate
    `),
    [
      'https://www.amazon.com/dp/B0ABCDEFGH',
      'https://www.amazon.fr/dp/B0ABCDEFGI',
    ],
  );
});

test('removes foreign marketplace and logistics copy from Amazon text', () => {
  const input = [
    '<p>Compact USB adapter compatible with phones and tablets.</p>',
    '<p>Only $19.99 with Prime delivery in the United States.</p>',
    '<li>Fast data transfer and durable aluminum body.</li>',
    '<li>Free returns within 30 days.</li>',
  ].join('');

  assert.equal(
    sanitizeAmazonMarketplaceText(input),
    'Compact USB adapter compatible with phones and tablets. Fast data transfer and durable aluminum body.',
  );
});

test('removes French and Arabic delivery or currency fragments', () => {
  const input = [
    'Connexion rapide et format compact.',
    'Livraison en France pour 20 EUR.',
    'هيكل متين للاستخدام اليومي.',
    'الشحن إلى الإمارات متاح.',
  ].join('\n');

  assert.equal(
    sanitizeAmazonMarketplaceText(input),
    'Connexion rapide et format compact. هيكل متين للاستخدام اليومي.',
  );
});
