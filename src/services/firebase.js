import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBMqwK7aUv1rBEzEvtfRk48g-ZQXyb4NHE",
  authDomain: "imden-errayany.firebaseapp.com",
  projectId: "imden-errayany",
  // storageBucket, messagingSenderId, appId are optional for basic Auth
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export default app;
