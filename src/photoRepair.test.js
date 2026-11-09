import { test, expect, vi } from 'vitest';
import { isLocalPhoto, countPendingPhotos, repairPendingPhotos } from './photoRepair.js';

const DATA = 'data:image/jpeg;base64,AAAA';
const URL1 = 'https://firebasestorage.googleapis.com/x/1.jpg';
const URL2 = 'https://firebasestorage.googleapis.com/x/2.jpg';

test('only data: URLs count as photos stuck on this phone', () => {
  expect(isLocalPhoto(DATA)).toBe(true);
  expect(isLocalPhoto(URL1)).toBe(false);
  expect(isLocalPhoto(null)).toBe(false);
  expect(countPendingPhotos([
    { id: 'a', photos: [DATA, URL1, DATA] },
    { id: 'b', photos: [URL2] },
    { id: 'c' },
  ])).toBe(2);
  expect(countPendingPhotos(undefined)).toBe(0);
});

test('a review is repaired only when every photo uploaded, then synced with its URLs', async () => {
  const reviews = [
    { id: 'a', photos: [DATA, URL1] },
    { id: 'b', photos: [URL2] },
  ];
  const upload = vi.fn().mockResolvedValue([URL2, URL1]);
  const sync = vi.fn().mockResolvedValue();
  const out = await repairPendingPhotos({ uid: 'u', reviews, upload, sync });
  expect(upload).toHaveBeenCalledTimes(1); // 'b' has nothing local
  expect(out.restored).toBe(1);
  expect(out.reviews[0]).toEqual({ id: 'a', photos: [URL2, URL1], photo: URL2 });
  expect(out.reviews[1]).toBe(reviews[1]);
  expect(sync).toHaveBeenCalledWith('u', out.reviews[0]);
});

test('a partial upload never writes a data: URL to the cloud and stays pending', async () => {
  const reviews = [{ id: 'a', photos: [DATA, DATA] }];
  const upload = vi.fn().mockResolvedValue([URL1, DATA]);
  const sync = vi.fn();
  const out = await repairPendingPhotos({ uid: 'u', reviews, upload, sync });
  expect(sync).not.toHaveBeenCalled();
  expect(out.restored).toBe(0);
  expect(countPendingPhotos(out.reviews)).toBe(2);
});

test('one review failing does not stop the others', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  const reviews = [{ id: 'a', photos: [DATA] }, { id: 'b', photos: [DATA] }];
  const upload = vi.fn()
    .mockRejectedValueOnce(new Error('storage/unauthorized'))
    .mockResolvedValueOnce([URL1]);
  const sync = vi.fn().mockRejectedValue(new Error('offline')); // a sync failure is not a repair failure
  const out = await repairPendingPhotos({ uid: 'u', reviews, upload, sync });
  expect(out.restored).toBe(1);
  expect(out.reviews.map((r) => r.photos[0])).toEqual([DATA, URL1]);
});
