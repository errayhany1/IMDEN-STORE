import { initializeApp } from "firebase/app";
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

export default app;
