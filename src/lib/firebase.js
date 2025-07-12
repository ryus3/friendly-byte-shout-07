import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyBVzYc9oi6G32loVRcFMXm3Dnv0wBWPwhw",
  authDomain: "ryus-acb9a.firebaseapp.com",
  projectId: "ryus-acb9a",
  storageBucket: "ryus-acb9a.appspot.com",
  messagingSenderId: "314543780295",
  appId: "1:314543780295:web:30a49d4cb14e6705ec69e2",
  measurementId: "G-5N1RK90NTW"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export { app, auth, db, storage };