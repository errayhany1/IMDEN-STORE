import test from 'node:test';
import assert from 'node:assert/strict';
import { parseTifawtSkuAliases, resolveTifawtOrderSku } from './tifawtSku.js';

test('multi-line aliases keep website carts mappable to stocked Tifawt SKUs', () => {
  const aliases = parseTifawtSkuAliases(`
MP3 car M53=OLD-MP3
Starry Sky=CHARGEUR-STARRY
DASH CAM WiFi=WIFI-CAM
`);
  assert.equal(resolveTifawtOrderSku('MP3 car M53', aliases), 'OLD-MP3');
  assert.equal(resolveTifawtOrderSku('Starry Sky', aliases), 'CHARGEUR-STARRY');
  assert.equal(resolveTifawtOrderSku('DASH CAM WiFi', aliases), 'WIFI-CAM');
});
