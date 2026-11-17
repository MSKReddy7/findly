/**
 * FINDLY Firebase Admin SDK Integration
 * Provides live connection to Google Cloud Firestore, Firebase Auth, and Firebase Storage.
 * Compatible with firebase-admin v13+ (uses top-level cert/initializeApp imports).
 */

const fs = require('fs');
const path = require('path');

// firebase-admin v13+ exports cert, initializeApp, getFirestore, getStorage at top level
let initializeApp = null;
let cert = null;
let getFirestore = null;
let getStorage = null;
let firestoreDb = null;
let storageBucket = null;

try {
  const admin = require('firebase-admin');
  const adminApp = require('firebase-admin/app');
  const adminFirestore = require('firebase-admin/firestore');
  const adminStorage = require('firebase-admin/storage');

  // Support both v12 (admin.credential.cert) and v13+ (top-level cert)
  cert = adminApp.cert || (admin.credential && admin.credential.cert) || admin.cert;
  initializeApp = adminApp.initializeApp || admin.initializeApp;
  getFirestore = adminFirestore.getFirestore;
  getStorage = adminStorage.getStorage;
} catch (err) {
  // Graceful fallback — try the legacy single-package import
  try {
    const admin = require('firebase-admin');
    cert = (admin.credential && admin.credential.cert) ? admin.credential.cert.bind(admin.credential) : admin.cert;
    initializeApp = admin.initializeApp.bind(admin);
    // Lazy-bind these after initializeApp
    getFirestore = () => admin.firestore();
    getStorage = () => admin.storage();
  } catch (e2) {
    console.warn('firebase-admin package not loaded:', e2.message);
  }
}

class FirebaseService {
  constructor() {
    this.initialized = false;
    this.projectId = null;
    this.init();
  }

  init() {
    if (!initializeApp || !cert) return;

    try {
      const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || 
                                path.join(__dirname, '..', 'serviceAccountKey.json');

      if (fs.existsSync(serviceAccountPath)) {
        const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf-8'));
        const app = initializeApp({
          credential: cert(serviceAccount),
          storageBucket: process.env.FIREBASE_STORAGE_BUCKET || `${serviceAccount.project_id}.appspot.com`
        });
        firestoreDb = getFirestore(app);
        storageBucket = getStorage(app).bucket();
        this.initialized = true;
        this.projectId = serviceAccount.project_id;
        console.log(`Connected to Google Cloud Firestore (Project: ${this.projectId})`);
      } else if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
        const app = initializeApp({
          credential: cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
          }),
          storageBucket: process.env.FIREBASE_STORAGE_BUCKET
        });
        firestoreDb = getFirestore(app);
        storageBucket = getStorage(app).bucket();
        this.initialized = true;
        this.projectId = process.env.FIREBASE_PROJECT_ID;
        console.log(`Connected to Google Cloud Firestore via env (Project: ${this.projectId})`);
      }
    } catch (err) {
      console.warn('Firebase Admin initialization deferred (using persistent JSON store):', err.message);
      this.initialized = false;
    }
  }

  isConfigured() {
    return this.initialized && Boolean(firestoreDb);
  }

  getDb() {
    return firestoreDb;
  }

  getBucket() {
    return storageBucket;
  }

  getAdmin() {
    return admin;
  }
}

module.exports = new FirebaseService();
