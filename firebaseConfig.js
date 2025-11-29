import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBbjy9bXBC0CJt7CM68Kb9533_f4ls-vbg",
  authDomain: "mywhatsapp-890e6.firebaseapp.com",
  projectId: "mywhatsapp-890e6",
  storageBucket: "mywhatsapp-890e6.firebasestorage.app",
  messagingSenderId: "555482597287",
  appId: "1:555482597287:web:d6cf5a706e9ef9a9275882",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);
export const db = getFirestore(app);
