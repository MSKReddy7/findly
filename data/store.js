/**
 * store.js — Pure Cloud-First Firestore Data Layer
 *
 * Architecture: Browser → server.js REST API → store.js → Cloud Firestore
 *
 * Rules:
 *  - Zero in-memory arrays as source of truth
 *  - Zero local file storage
 *  - Every read/write goes directly to Cloud Firestore
 *  - Session stored in Firestore 'sessions/active'
 */

const firebaseAdmin = require('./firebase-admin');

// ─── Initial demo accounts for authentication / role switcher ─────────────────
const INITIAL_USERS = [
  {
    uid: 'user_alex',
    displayName: 'Alex Rivera',
    email: 'alex.rivera@campus.edu',
    phoneNumber: '+1 (555) 234-5678',
    role: 'user',
    accountStatus: 'active',
    profileImage: '',
    createdAt: new Date(Date.now() - 15 * 86400000).toISOString()
  },
  {
    uid: 'user_maya',
    displayName: 'Maya Lin',
    email: 'maya.lin@campus.edu',
    phoneNumber: '+1 (555) 876-5432',
    role: 'user',
    accountStatus: 'active',
    profileImage: '',
    createdAt: new Date(Date.now() - 10 * 86400000).toISOString()
  },
  {
    uid: 'user_sarah_admin',
    displayName: 'Officer Sarah Chen (Admin)',
    email: 'admin.chen@campus.edu',
    phoneNumber: '+1 (555) 999-0011',
    role: 'admin',
    accountStatus: 'active',
    profileImage: '',
    createdAt: new Date(Date.now() - 30 * 86400000).toISOString()
  }
];

class Store {
  constructor() {
    this._session = { user: INITIAL_USERS[0], theme: 'dark' };
    this._db = null;
    this.ready = this._init().catch(err =>
      console.warn('[Store] Init warning:', err.message)
    );
  }

  async _init() {
    if (!firebaseAdmin.isConfigured()) {
      console.warn('[Store] Firebase not configured — running in degraded mode.');
      return;
    }
    this._db = firebaseAdmin.getDb();
    if (!this._db) {
      console.warn('[Store] Firestore DB not available.');
      return;
    }

    // Seed demo users if empty or ensure phoneNumber exists
    const usersSnap = await this._db.collection('users').get();
    if (usersSnap.empty) {
      const batch = this._db.batch();
      for (const u of INITIAL_USERS) {
        batch.set(this._db.collection('users').doc(u.uid), u);
      }
      await batch.commit();
      console.log('[Store] Seeded demo users to Firestore.');
    } else {
      const batch = this._db.batch();
      for (const u of INITIAL_USERS) {
        batch.set(this._db.collection('users').doc(u.uid), { phoneNumber: u.phoneNumber }, { merge: true });
      }
      await batch.commit();
    }

    // Ensure notifications collection exists in Firestore with empty data placeholder
    const notifsSnap = await this._db.collection('notifications').get();
    if (notifsSnap.empty) {
      await this._db.collection('notifications').doc('_init').set({
        _init: true,
        note: 'Initialized notifications collection with empty data',
        createdAt: new Date().toISOString()
      });
    }

    // Load active session from Firestore
    const sessDoc = await this._db.collection('sessions').doc('active').get();
    if (sessDoc.exists && !sessDoc.data()._init) {
      this._session = sessDoc.data();
    } else {
      this._session = { user: INITIAL_USERS[0], theme: 'dark' };
      await this._db.collection('sessions').doc('active').set(this._session);
    }

    console.log('[Store] Pure Cloud-First backend ready → Firestore project:', firebaseAdmin.projectId);
  }

  _requireDb() {
    if (!this._db) throw new Error('Firestore not available');
  }

  // ─── SESSION ────────────────────────────────────────────────────────────────

  getSession() {
    return this._session;
  }

  async setSessionUser(user) {
    this._session.user = user;
    if (this._db) {
      await this._db.collection('sessions').doc('active').set(
        { user },
        { merge: true }
      );
    }
  }

  async setSessionTheme(theme) {
    this._session.theme = theme;
    if (this._db) {
      await this._db.collection('sessions').doc('active').set(
        { theme },
        { merge: true }
      );
    }
  }

  // ─── USERS ──────────────────────────────────────────────────────────────────

  async getUsers() {
    await this.ready;
    this._requireDb();
    const snap = await this._db.collection('users').get();
    return snap.docs
      .map(d => d.data())
      .filter(u => !u._init && d_valid(u));
  }

  async getUser(uid) {
    await this.ready;
    this._requireDb();
    if (!uid || uid === '_init') return null;
    const doc = await this._db.collection('users').doc(uid).get();
    return doc.exists && !doc.data()._init ? doc.data() : null;
  }

  async createUser(user) {
    await this.ready;
    this._requireDb();
    await this._db.collection('users').doc(user.uid).set(user);
    return user;
  }

  async updateUser(uid, updates) {
    await this.ready;
    this._requireDb();
    await this._db.collection('users').doc(uid).set(updates, { merge: true });
    return await this.getUser(uid);
  }

  // ─── REPORTS ────────────────────────────────────────────────────────────────

  async getReports(filters = {}) {
    await this.ready;
    this._requireDb();
    const snap = await this._db.collection('reports').get();
    let reports = snap.docs
      .map(d => d.data())
      .filter(r => !r._init && r.id && r.id !== '_init');

    const { ownerId, type, category, status, location, q } = filters;

    if (ownerId) {
      reports = reports.filter(r => r.ownerId === ownerId);
    }
    if (type && type !== 'all') {
      reports = reports.filter(r => (r.type || '').toLowerCase() === type.toLowerCase());
    }
    if (category && category !== 'all') {
      reports = reports.filter(r => (r.category || '').toLowerCase() === category.toLowerCase());
    }
    if (status && status !== 'all') {
      reports = reports.filter(r => (r.status || 'open').toLowerCase() === status.toLowerCase());
    }
    if (location) {
      reports = reports.filter(r => (r.location || '').toLowerCase().includes(location.toLowerCase()));
    }
    if (q) {
      const tokens = q.toLowerCase().split(/\s+/).filter(Boolean);
      reports = reports.filter(r => {
        const text = `${r.title} ${r.description} ${r.category} ${r.location} ${r.ownerName} ${r.phoneNumber || ''}`.toLowerCase();
        return tokens.some(t => text.includes(t));
      });
    }

    reports.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return reports;
  }

  async getReport(id) {
    await this.ready;
    this._requireDb();
    if (!id || id === '_init') return null;
    const doc = await this._db.collection('reports').doc(id).get();
    return doc.exists && !doc.data()._init ? doc.data() : null;
  }

  async createReport(report) {
    await this.ready;
    this._requireDb();
    await this._db.collection('reports').doc(report.id).set(report);
    return report;
  }

  async updateReport(id, updates) {
    await this.ready;
    this._requireDb();
    updates.updatedAt = new Date().toISOString();
    await this._db.collection('reports').doc(id).set(updates, { merge: true });
    return await this.getReport(id);
  }

  async deleteReport(id) {
    await this.ready;
    this._requireDb();
    await this._db.collection('reports').doc(id).delete();
  }

  // ─── ADMIN STATS ────────────────────────────────────────────────────────────

  async getAdminStats() {
    await this.ready;
    this._requireDb();
    const reports = await this.getReports();
    
    // Exact requested cases:
    // 1. Lost and not found (open)
    const lostOpen = reports.filter(r => r.type === 'lost' && (r.status === 'open' || !r.status)).length;
    // 2. Found and not collected (open)
    const foundOpen = reports.filter(r => r.type === 'found' && (r.status === 'open' || !r.status)).length;
    // 3. Lost and collected (closed)
    const lostClosed = reports.filter(r => r.type === 'lost' && r.status === 'closed').length;
    // 4. Found and collected (closed)
    const foundClosed = reports.filter(r => r.type === 'found' && r.status === 'closed').length;
    // Total resolved (lost collected + found collected)
    const totalClosed = lostClosed + foundClosed;
    const total = reports.length;

    return {
      total,
      lostOpen,       // Lost & not found
      foundOpen,      // Found & not collected
      lostClosed,     // Lost & collected
      foundClosed,    // Found & collected
      totalClosed     // Total (Lost collected + Found collected)
    };
  }

  // ─── STATUS ─────────────────────────────────────────────────────────────────

  async getStatus() {
    const connected = firebaseAdmin.isConfigured() && !!this._db;
    let reportsCount = 0, usersCount = 0;
    if (connected) {
      try {
        const [rs, us] = await Promise.all([
          this._db.collection('reports').get(),
          this._db.collection('users').get()
        ]);
        reportsCount = rs.docs.filter(d => !d.data()._init && d.id !== '_init').length;
        usersCount = us.docs.filter(d => !d.data()._init && d.id !== '_init').length;
      } catch (_) {}
    }
    return {
      storageType: 'Google Cloud Firestore (Pure Cloud-First)',
      firebaseConnected: connected,
      firebaseProjectId: firebaseAdmin.projectId || null,
      reportsCount,
      usersCount
    };
  }
}

function d_valid(obj) {
  return obj && obj.uid;
}

module.exports = new Store();
