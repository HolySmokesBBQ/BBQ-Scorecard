// Review photos that never reached Firebase Storage. A photo is held as a
// data: URL until an upload replaces it with an https URL, so any data: URL
// still on a review is a photo that exists only on this phone.
//
// Until 4.4.5 the app noticed a failed upload (syncStatus 'photos-failed')
// but nothing ever showed it, and the post-save sync overwrote it with
// 'done' a moment later. The pending count below is derived from the
// reviews themselves, so the banner can't be overwritten or forgotten.

export const isLocalPhoto = (p) => typeof p === 'string' && p.startsWith('data:');

export function countPendingPhotos(reviews) {
  return (reviews || []).reduce((n, r) => n + (r.photos || []).filter(isLocalPhoto).length, 0);
}

// Upload every review's local photos and write the review's photo fields to
// the cloud. A review only counts as repaired when ALL its photos uploaded:
// syncReviewWithPhotos must never write a data: URL to Firestore. Partial
// progress is retried whole next time. Returns the updated list and how
// many reviews were repaired.
export async function repairPendingPhotos({ uid, reviews, upload, sync }) {
  const repaired = new Map();
  for (const rev of reviews) {
    const photos = rev.photos || [];
    if (!photos.some(isLocalPhoto)) continue;
    try {
      const urls = await upload(uid, rev.id, photos);
      if (urls.some(isLocalPhoto)) continue; // upload cap or transient failure
      const patched = { ...rev, photos: urls, photo: urls[0] || null };
      repaired.set(rev.id, patched);
      try { await sync(uid, patched); } catch {}
    } catch (e) {
      console.error(`Photo repair failed for review ${rev.id}:`, e);
    }
  }
  if (!repaired.size) return { reviews, restored: 0 };
  return { reviews: reviews.map((r) => repaired.get(r.id) || r), restored: repaired.size };
}
