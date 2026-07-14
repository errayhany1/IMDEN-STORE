import { getApps, initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBMqWK7aUv1rBeZEvtfrK48g-ZQXyb4NHE",
  authDomain: "imden-errayany.firebaseapp.com",
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
