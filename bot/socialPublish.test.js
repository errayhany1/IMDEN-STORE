import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createAndPublishSocialPost,
  parseTagList,
  withHashtags,
  withInlineHashtags,
  bilingualText,
  pickTikTokPrivacy,
  recordingLocationPayload,
  shopNowCta,
} from './socialPublish.js';

test('parseTagList splits, strips hashes, and caps at 15 unique tags', () => {
  assert.deepEqual(
    parseTagList('Errayhany, Grossiste, #جملة, Errayhany'),
    ['Errayhany', 'Grossiste', 'جملة'],
  );
  const many = Array.from({ length: 20 }, (_, i) => `tag${i}`).join(', ');
  assert.equal(parseTagList(many).length, 15);
});

test('withHashtags appends missing hashes and skips ones already in the text', () => {
  assert.equal(
    withHashtags('شواحن جملة\n#Errayhany', ['Errayhany', 'Grossiste']),
    'شواحن جملة\n#Errayhany\n\n#Grossiste',
  );
  assert.equal(withHashtags('', ['VIP']), '#VIP');
});

test('withInlineHashtags keeps TikTok captions on one line', () => {
  assert.equal(
    withInlineHashtags('شواحن جملة', ['Errayhany', 'Grossiste']),
    'شواحن جملة #Errayhany #Grossiste',
  );
});

test('bilingualText joins Arabic and French with a separator', () => {
  assert.equal(bilingualText('عربي', 'francais'), 'عربي\n\n---\n\nfrancais');
  assert.equal(bilingualText('عربي', ''), 'عربي');
  assert.equal(bilingualText('', 'francais'), 'francais');
});

test('shopNowCta builds Facebook SHOP_NOW only when enabled with a link', () => {
  assert.equal(shopNowCta('', true), null);
  assert.equal(shopNowCta('https://errayhany.com/vip', false), null);
  assert.deepEqual(shopNowCta('https://errayhany.com/vip', true), {
    type: 'SHOP_NOW',
    value: { link: 'https://errayhany.com/vip' },
  });
});

test('pickTikTokPrivacy prefers the requested level when the creator allows it', () => {
  assert.equal(pickTikTokPrivacy('PUBLIC_TO_EVERYONE', []), 'PUBLIC_TO_EVERYONE');
  assert.equal(
    pickTikTokPrivacy('PUBLIC_TO_EVERYONE', ['SELF_ONLY', 'MUTUAL_FOLLOW_FRIENDS']),
    'MUTUAL_FOLLOW_FRIENDS',
  );
  assert.equal(
    pickTikTokPrivacy('SELF_ONLY', ['PUBLIC_TO_EVERYONE', 'SELF_ONLY']),
    'SELF_ONLY',
  );
});

test('recordingLocationPayload maps Casablanca to coordinates', () => {
  const loc = recordingLocationPayload('Casablanca, Morocco');
  assert.equal(loc.locationDescription, 'Casablanca, Morocco');
  assert.equal(loc.location.latitude, 33.5731);
  assert.equal(loc.location.longitude, -7.5898);
  assert.equal(recordingLocationPayload(''), null);
});

test('createAndPublishSocialPost stores French copy and reach flags', async () => {
  const post = await createAndPublishSocialPost({
    platforms: ['meta'],
    caption: 'منشور',
    title: 'عنوان',
    youtubeDescription: 'وصف يوتيوب',
    facebookDescription: 'وصف فيسبوك',
    titleFr: 'Titre FR',
    youtubeDescriptionFr: 'Desc YT FR',
    facebookDescriptionFr: 'Desc FB FR',
    tags: 'Errayhany',
    callToAction: true,
    recordingLocation: 'Casablanca, Morocco',
  });
  assert.equal(post.titleFr, 'Titre FR');
  assert.equal(post.youtubeDescriptionFr, 'Desc YT FR');
  assert.equal(post.facebookDescriptionFr, 'Desc FB FR');
  assert.equal(post.callToAction, true);
  assert.equal(post.recordingLocation, 'Casablanca, Morocco');
  assert.equal(post.results.meta?.ok, false);
});

test('createAndPublishSocialPost requires platforms and video for YouTube/TikTok', async () => {
  await assert.rejects(
    () => createAndPublishSocialPost({ caption: 'x', platforms: [] }),
    (err) => err.message === 'platforms_required' && err.statusCode === 400,
  );
  await assert.rejects(
    () => createAndPublishSocialPost({
      platforms: ['youtube'],
      caption: 'عرض',
      youtubeDescription: 'وصف يوتيوب',
      tags: 'Errayhany, جملة',
    }),
    (err) => err.message === 'media_required_for_video_platforms' && err.statusCode === 400,
  );
  await assert.rejects(
    () => createAndPublishSocialPost({
      platforms: ['tiktok'],
      caption: 'x',
      media: { mime: 'image/jpeg', filename: 'photo.jpg' },
    }),
    (err) => err.message === 'media_required_for_video_platforms',
  );
});
