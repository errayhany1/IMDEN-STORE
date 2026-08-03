import test from 'node:test';
import assert from 'node:assert/strict';
import {
  toTifawtSku,
  parseTifawtSkuAliases,
  resolveTifawtOrderSku,
} from './tifawtSku.js';

test('strips ERY namespace and color suffix for Tifawt', () => {
  assert.equal(toTifawtSku('ERY-WATCH-10-JCBCNO'), 'WATCH-10');
  assert.equal(toTifawtSku('MP3 car M53'), 'MP3-CAR-M53');
});

test('parses website→Tifawt alias lines', () => {
  const map = parseTifawtSkuAliases(`
# stock already exists under old codes
MP3 car M53 = OLD-MP3-40W
Starry Sky=CHARGEUR-STARRY
ERY-K007 => K007-HOLDER
`);
  assert.equal(map.get('MP3-CAR-M53'), 'OLD-MP3-40W');
  assert.equal(map.get('STARRY-SKY'), 'CHARGEUR-STARRY');
  assert.equal(map.get('K007'), 'K007-HOLDER');
});

test('resolveTifawtOrderSku prefers alias over normalized website ref', () => {
  const aliases = 'DASH CAM WiFi=WIFI-DASH-CAM\nAZAMI=SUPPORT-AZAMI-MAGNETIC-HOLDER';
  assert.equal(resolveTifawtOrderSku('DASH CAM WiFi', aliases), 'WIFI-DASH-CAM');
  assert.equal(resolveTifawtOrderSku('AZAMI', aliases), 'SUPPORT-AZAMI-MAGNETIC-HOLDER');
  assert.equal(
    resolveTifawtOrderSku('ERY-SUPPORT-AZAMI-MAGNETIC-HOLDER', aliases),
    'SUPPORT-AZAMI-MAGNETIC-HOLDER',
  );
});
