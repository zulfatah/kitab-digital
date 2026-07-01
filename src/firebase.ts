/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import firebaseConfig from '../firebase-applet-config.json';

// Inisialisasi Firebase App menggunakan config otomatis
const app = initializeApp(firebaseConfig);

// Inisialisasi Firestore dengan Database ID dari config
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId || "default");

// Inisialisasi Auth & Google Provider
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

