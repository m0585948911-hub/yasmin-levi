
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDW7Qr46lj42gd1y2PUi_NigiEH1tjJ2c0",
  authDomain: "yasmin-beauty-diary.firebaseapp.com",
  projectId: "yasmin-beauty-diary",
  storageBucket: "yasmin-beauty-diary.appspot.com",
  messagingSenderId: "90023766755",
  appId: "1:90023766755:web:0390d8df4b00fc58ba73d6"
};

// Initialize Firebase
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db };
