import { getApps, initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

// Sign-in via popup/redirect relies on a hidden iframe hosted on
// `authDomain` to relay the pending sign-in result back to the app. If that
// domain is a different site than the one the visitor is actually on (e.g.
// the default *.firebaseapp.com domain vs. our own custom domains), modern
// browsers partition IndexedDB/storage per top-level site and silently drop
// that relay: the redirect to Google completes, the user is sent back, but
// no error and no signed-in user ever appear.
//
// The fix is to make the auth flow first-party by pointing `authDomain` at
// whichever of our own domains served the page, and having nginx proxy
// `/__/auth/*` and `/__/firebase/init.json` on that same domain through to
// Firebase's real handler (see nginx.conf). Since we serve the app from two
// custom domains during the migration, pick the matching one at runtime and
// fall back to the default Firebase domain outside of production (e.g. local
// dev), where no such proxy exists.
const PROXIED_AUTH_DOMAINS = ["errayhany.com", "imdenmanadger.online"];
const DEFAULT_AUTH_DOMAIN = "imden-errayany.firebaseapp.com";

function resolveAuthDomain() {
  if (typeof window === "undefined") return DEFAULT_AUTH_DOMAIN;
  const host = window.location.hostname;
  const matched = PROXIED_AUTH_DOMAINS.find(
    domain => host === domain || host.endsWith(`.${domain}`)
  );
  return matched || DEFAULT_AUTH_DOMAIN;
}

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBMqWK7aUv1rBeZEvtfrK48g-ZQXyb4NHE",
  authDomain: resolveAuthDomain(),
  projectId: "imden-errayany",
  storageBucket: "imden-errayany.firebasestorage.app",
  messagingSenderId: "883521717891",
  appId: "1:883521717891:web:d9443362f4febbc4e9fdb6",
  measurementId: "G-82BHFMGSG1"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// A secondary Auth instance verifies a Google/email customer's phone without
// replacing their primary signed-in session.
const phoneVerificationApp = getApps().find(
  existingApp => existingApp.name === 'phone-verification'
) || initializeApp(firebaseConfig, 'phone-verification');
export const phoneVerificationAuth = getAuth(phoneVerificationApp);

export default app;
