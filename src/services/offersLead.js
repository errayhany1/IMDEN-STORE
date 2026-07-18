import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from './firebase';

const sanitize = (value, max = 320) => (
  typeof value === 'string' ? value.trim().slice(0, max) : ''
);

/**
 * Save / refresh a marketing lead whenever a shopper signs in with an email.
 * Collection: offersLeads/{uid}
 */
export const upsertOffersLead = async (user, extras = {}) => {
  if (!user?.uid) return null;
  const email = sanitize(user.email || extras.email || '', 320).toLowerCase();
  if (!email || !email.includes('@')) return null;

  const ref = doc(db, 'offersLeads', user.uid);
  const existing = await getDoc(ref);
  const name = sanitize(extras.name || user.displayName || '', 100);
  const phone = sanitize(extras.phone || user.phoneNumber || '', 30);

  await setDoc(ref, {
    uid: user.uid,
    email,
    name,
    phone,
    source: sanitize(extras.source || 'auth', 40),
    offersOptIn: extras.offersOptIn !== false,
    createdAt: existing.exists()
      ? existing.data().createdAt
      : serverTimestamp(),
    updatedAt: serverTimestamp(),
  }, { merge: true });

  return { uid: user.uid, email };
};
