require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const store = require('./data/store');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use('/public', express.static(path.join(__dirname, 'public')));
app.use('/css', express.static(path.join(__dirname, 'public', 'css')));
app.use(express.static(path.join(__dirname, 'src')));

/** Resolve current user — reads directly from Firestore */
async function getSessionUser(req) {
  const userId = req.headers['x-user-id'] || req.query.currentUserId;
  if (userId) {
    const user = await store.getUser(userId);
    if (user) return user;
  }
  const session = store.getSession();
  if (session && session.user && session.user.uid) {
    const user = await store.getUser(session.user.uid);
    if (user) return user;
  }
  return null;
}

async function requireAuth(req, res, next) {
  try {
    const user = await getSessionUser(req);
    if (!user) return res.status(401).json({ error: 'Authentication required. Please sign in.' });
    req.user = user;
    next();
  } catch (err) {
    res.status(500).json({ error: 'Auth lookup failed' });
  }
}

async function requireAdmin(req, res, next) {
  try {
    const user = await getSessionUser(req);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ error: 'Administrator access required.' });
    }
    req.user = user;
    next();
  } catch (err) {
    res.status(500).json({ error: 'Auth lookup failed' });
  }
}

/* =============================================================
 * SESSION
 * =========================================================== */

app.get('/api/session', async (req, res) => {
  try {
    const session = store.getSession();
    const dbStatus = await store.getStatus();
    res.json({ user: session.user || null, theme: session.theme || 'dark', database: dbStatus });
  } catch (err) {
    res.status(500).json({ error: 'Session lookup failed' });
  }
});

app.post('/api/session/user', async (req, res) => {
  try {
    const { user } = req.body;
    if (user && user.uid) {
      const verified = (await store.getUser(user.uid)) || user;
      await store.setSessionUser(verified);
    }
    res.json({ success: true, session: store.getSession() });
  } catch (err) {
    res.status(500).json({ error: 'Session update failed' });
  }
});

app.post('/api/session/theme', async (req, res) => {
  try {
    const { theme } = req.body;
    if (theme) await store.setSessionTheme(theme);
    res.json({ success: true, session: store.getSession() });
  } catch (err) {
    res.status(500).json({ error: 'Theme update failed' });
  }
});

app.post('/api/session/logout', async (req, res) => {
  try {
    await store.setSessionUser(null);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Logout failed' });
  }
});

/* =============================================================
 * USERS & AUTH
 * =========================================================== */

app.get('/api/users/me', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] || req.query.currentUserId;
    if (!userId) return res.json({ user: null, role: 'guest' });
    const user = await store.getUser(userId);
    if (!user) return res.json({ user: null, role: 'guest' });
    res.json({
      user: {
        uid: user.uid,
        displayName: user.displayName,
        email: user.email,
        phoneNumber: user.phoneNumber || '',
        role: user.role,
        profileImage: user.profileImage,
        createdAt: user.createdAt
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'User lookup failed' });
  }
});

app.get('/api/users/list', async (req, res) => {
  try {
    const users = await store.getUsers();
    res.json({
      users: users.map(u => ({
        uid: u.uid,
        displayName: u.displayName,
        email: u.email,
        phoneNumber: u.phoneNumber || '',
        role: u.role
      }))
    });
  } catch (err) {
    res.status(500).json({ error: 'User list failed' });
  }
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const { displayName, email, phoneNumber, role } = req.body;
    if (!displayName || !email) return res.status(400).json({ error: 'Display name and email are required.' });
    const users = await store.getUsers();
    if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
      return res.status(400).json({ error: 'An account with this email already exists.' });
    }
    const newUser = {
      uid: `user_${Date.now()}`,
      displayName: displayName.trim(),
      email: email.trim(),
      phoneNumber: (phoneNumber || '').trim(),
      role: role === 'admin' ? 'admin' : 'user',
      accountStatus: 'active',
      profileImage: '',
      createdAt: new Date().toISOString()
    };
    await store.createUser(newUser);
    res.status(201).json({ user: newUser });
  } catch (err) {
    res.status(500).json({ error: 'Registration failed: ' + err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required.' });
    const users = await store.getUsers();
    const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (!user) return res.status(404).json({ error: 'User not found. Check email or register a new account.' });
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: 'Login failed: ' + err.message });
  }
});

/* =============================================================
 * REPORTS
 * =========================================================== */

app.get('/api/reports', async (req, res) => {
  try {
    const { type, category, status, location, q, ownerId } = req.query;
    let reports = await store.getReports({ type, category, location, q, ownerId });
    if (!ownerId && (!status || status === 'all')) {
      reports = reports.filter(r => r.status !== 'under_review' && r.status !== 'archived');
    } else if (status && status !== 'all') {
      reports = reports.filter(r => (r.status || '').toLowerCase() === status.toLowerCase());
    }
    res.json({
      reports: reports.map(r => ({
        id: r.id,
        type: r.type,
        title: r.title,
        category: r.category,
        description: r.description,
        location: r.location,
        date: r.date,
        imageUrls: r.imageUrls || [],
        status: r.status || 'open',
        ownerId: r.ownerId,
        ownerName: r.ownerName,
        phoneNumber: r.phoneNumber || '',
        createdAt: r.createdAt
      }))
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch reports: ' + err.message });
  }
});

app.get('/api/reports/:id', async (req, res) => {
  try {
    const report = await store.getReport(req.params.id);
    if (!report) return res.status(404).json({ error: 'Report not found' });
    res.json({ report });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch report: ' + err.message });
  }
});

app.post('/api/reports', requireAuth, async (req, res) => {
  try {
    const { type, title, category, description, location, date, imageUrls, phoneNumber } = req.body;
    if (!type || !title || !category) {
      return res.status(400).json({ error: 'Type, title, and category are required.' });
    }
    const phone = (phoneNumber || req.user.phoneNumber || '').trim();
    if (!phone) {
      return res.status(400).json({ error: 'Contact phone number is required.' });
    }
    const newReport = {
      id: `rep_${Date.now()}`,
      ownerId: req.user.uid,
      ownerName: req.user.displayName,
      phoneNumber: phone,
      type: type.toLowerCase() === 'found' ? 'found' : 'lost',
      title: title.trim(),
      category: category.trim(),
      description: (description || '').trim(),
      location: (location || 'General Community Area').trim(),
      date: date || new Date().toISOString().split('T')[0],
      imageUrls: Array.isArray(imageUrls) ? imageUrls : (imageUrls ? [imageUrls] : []),
      status: 'open',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await store.createReport(newReport);
    res.status(201).json({ report: newReport });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create report: ' + err.message });
  }
});

app.patch('/api/reports/:id', requireAuth, async (req, res) => {
  try {
    const report = await store.getReport(req.params.id);
    if (!report) return res.status(404).json({ error: 'Report not found' });
    if (report.ownerId !== req.user.uid && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'You are not authorized to update this report.' });
    }
    const { title, category, description, location, date, status, phoneNumber, imageUrls } = req.body;
    const updates = {};
    if (title) updates.title = title.trim();
    if (category) updates.category = category.trim();
    if (description !== undefined) updates.description = (description || '').trim();
    if (location) updates.location = location.trim();
    if (date) updates.date = date;
    if (phoneNumber !== undefined) updates.phoneNumber = phoneNumber.trim();
    if (status) {
      const validStatuses = ['open', 'closed', 'matched', 'resolved', 'archived', 'under_review'];
      if (validStatuses.includes(status)) updates.status = status;
    }
    if (Array.isArray(imageUrls)) updates.imageUrls = imageUrls;
    const updated = await store.updateReport(req.params.id, updates);
    res.json({ report: updated });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update report: ' + err.message });
  }
});

app.delete('/api/reports/:id', requireAuth, async (req, res) => {
  try {
    const report = await store.getReport(req.params.id);
    if (!report) return res.status(404).json({ error: 'Report not found' });
    if (report.ownerId !== req.user.uid && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'You are not authorized to delete this report.' });
    }
    await store.deleteReport(req.params.id);
    res.json({ success: true, message: 'Report deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete report: ' + err.message });
  }
});

/* =============================================================
 * SEARCH
 * =========================================================== */

app.get('/api/search', async (req, res) => {
  try {
    const { q, type, category, location, status } = req.query;
    let reports = await store.getReports({ type, category, location, q });
    if (!status || status === 'all') {
      reports = reports.filter(r => r.status !== 'archived' && r.status !== 'under_review');
    } else {
      reports = reports.filter(r => (r.status || '').toLowerCase() === status.toLowerCase());
    }
    res.json({ count: reports.length, reports });
  } catch (err) {
    res.status(500).json({ error: 'Search failed: ' + err.message });
  }
});

/* =============================================================
 * SYSTEM & ADMIN
 * =========================================================== */

app.get('/api/system/status', async (req, res) => {
  try {
    const dbStatus = await store.getStatus();
    res.json({ database: dbStatus, storageBackend: 'Google Cloud Firestore (Pure Cloud-First)' });
  } catch (err) {
    res.status(500).json({ error: 'Status check failed: ' + err.message });
  }
});

app.get('/api/admin/stats', requireAdmin, async (req, res) => {
  try {
    const stats = await store.getAdminStats();
    res.json({ stats });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch admin stats: ' + err.message });
  }
});

app.patch('/api/admin/reports/:id', requireAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    const report = await store.getReport(req.params.id);
    if (!report) return res.status(404).json({ error: 'Report not found' });
    const updated = await store.updateReport(req.params.id, { status });
    res.json({ report: updated });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update report: ' + err.message });
  }
});

app.patch('/api/admin/reports/:id/status', requireAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    const report = await store.getReport(req.params.id);
    if (!report) return res.status(404).json({ error: 'Report not found' });
    const updated = await store.updateReport(req.params.id, { status });
    res.json({ report: updated });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update report: ' + err.message });
  }
});

app.use((req, res) => res.sendFile(path.join(__dirname, 'src', 'index.html')));
app.use((err, req, res, next) => { console.error('Server error:', err); res.status(500).json({ error: 'Internal server error' }); });

process.on('uncaughtException', err => console.error('Uncaught Exception:', err));
process.on('unhandledRejection', reason => console.error('Unhandled Rejection:', reason));

app.listen(PORT, () => {
  console.log(`\n🚀 Findly running on http://localhost:${PORT}`);
  console.log(`☁️  Pure Cloud-First → Firestore | No AI\n`);
});
