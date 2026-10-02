import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBhykiQ8JEjA3St_l22CTKcCAZyTmMClno",
  authDomain: "money-8d4f1.firebaseapp.com",
  projectId: "money-8d4f1",
  storageBucket: "money-8d4f1.firebasestorage.app",
  messagingSenderId: "670353681686",
  appId: "1:670353681686:web:bdb63dbc70dd1792eb3437",
  measurementId: "G-2WGFRK7NWN"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

export { db, auth };