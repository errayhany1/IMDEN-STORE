import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createAndPublishSocialPost,
  parseTagList,
  withHashtags,
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
