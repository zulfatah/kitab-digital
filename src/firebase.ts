/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

// Konfigurasi Firebase dari env dengan fallback ke nilai default
const firebaseConfig = {
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "arcane-trilogy-871nt",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:622654412825:web:efb5ab03ea51931fa8f288",
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyCrIMDQfZX3UXmxYn-6dOpXFJeJ29C_s30",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "arcane-trilogy-871nt.firebaseapp.com",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "arcane-trilogy-871nt.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "622654412825"
};

// Inisialisasi Firebase App
const app = initializeApp(firebaseConfig);

// Inisialisasi Firestore dengan Database ID khusus yang dibuat oleh AI Studio atau dari env
export const db = getFirestore(app, import.meta.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID || "ai-studio-bc367070-6a0a-4f29-91a1-a89ec0addda1");

// Inisialisasi Auth & Google Provider
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

