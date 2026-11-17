/**
 * FINDLY Test Suite — Verifies Pure Cloud-First Firestore API Endpoints (Direct Phone Contact Architecture)
 */

const BASE_URL = 'http://localhost:3000';

async function runTests() {
  console.log('--- STARTING FINDLY API TESTS (Pure Cloud-First, Direct Phone Contact, No AI) ---');
  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`✅ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`❌ [FAIL] ${name}:`, err.message);
      failed++;
    }
  }

  // 1. Session Status
  await test('GET /api/session', async () => {
    const res = await fetch(`${BASE_URL}/api/session`);
    const data = await res.json();
    if (!data.database) throw new Error('Expected database status');
  });

  // 2. Get Me (Guest mode)
  await test('GET /api/users/me (Guest)', async () => {
    const res = await fetch(`${BASE_URL}/api/users/me`);
    const data = await res.json();
    if (data.role !== 'guest') throw new Error('Expected guest role');
  });

  // 3. Get Me (Authenticated with phone)
  await test('GET /api/users/me (User Alex with phone)', async () => {
    const res = await fetch(`${BASE_URL}/api/users/me`, {
      headers: { 'x-user-id': 'user_alex' }
    });
    const data = await res.json();
    if (data.user?.displayName !== 'Alex Rivera') throw new Error('Expected Alex Rivera');
    if (!data.user?.phoneNumber) throw new Error('Expected user phone number');
  });

  // 4. List Users
  await test('GET /api/users/list', async () => {
    const res = await fetch(`${BASE_URL}/api/users/list`);
    const data = await res.json();
    if (!Array.isArray(data.users) || data.users.length === 0) throw new Error('Expected users list');
  });

  // 5. List Reports
  await test('GET /api/reports', async () => {
    const res = await fetch(`${BASE_URL}/api/reports`);
    const data = await res.json();
    if (!Array.isArray(data.reports)) throw new Error('Expected reports array');
  });

  // 6. Create Report with Phone Number (Case 1 / Case 2)
  let createdReportId = null;
  await test('POST /api/reports (with phone number)', async () => {
    const payload = {
      type: 'found',
      title: 'Sony Wireless Headphones WH-1000XM4',
      category: 'Electronics',
      description: 'Found black headphones in study lounge on table 4.',
      location: 'Study Lounge',
      phoneNumber: '+1 (555) 234-5678',
      date: new Date().toISOString().split('T')[0]
    };
    const res = await fetch(`${BASE_URL}/api/reports`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': 'user_alex'
      },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!data.report?.id) throw new Error('Report creation failed');
    if (data.report.status !== 'open') throw new Error('Expected default status to be open');
    if (!data.report.phoneNumber) throw new Error('Expected phone number in created report');
    createdReportId = data.report.id;
  });

  // 6b. Create Report with empty description "" (Description can also be "")
  await test('POST /api/reports (with empty description "")', async () => {
    const payload = {
      type: 'lost',
      title: 'Titan Steel Watch',
      category: 'Jewelry & Watches',
      description: '',
      location: 'Campus Gym',
      phoneNumber: '+91 9876543210',
      date: new Date().toISOString().split('T')[0]
    };
    const res = await fetch(`${BASE_URL}/api/reports`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': 'user_alex'
      },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!data.report?.id) throw new Error('Report creation with empty description failed');
    if (data.report.description !== '') throw new Error('Expected description to be empty string');
    await fetch(`${BASE_URL}/api/reports/${data.report.id}`, {
      method: 'DELETE',
      headers: { 'x-user-id': 'user_alex' }
    });
  });

  // 7. Toggle Report Status to 'closed' (Case 1: User verifies proof offline and marks closed)
  await test('PATCH /api/reports/:id (mark closed)', async () => {
    const res = await fetch(`${BASE_URL}/api/reports/${createdReportId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': 'user_alex'
      },
      body: JSON.stringify({ status: 'closed' })
    });
    const data = await res.json();
    if (data.report?.status !== 'closed') throw new Error('Report status update to closed failed');
  });

  // 8. Admin Statistics API
  await test('GET /api/admin/stats (verifying all 6 requested metrics)', async () => {
    const res = await fetch(`${BASE_URL}/api/admin/stats`, {
      headers: { 'x-user-id': 'user_sarah_admin' }
    });
    const data = await res.json();
    if (!data.stats) throw new Error('Expected stats object');
    const { total, lostOpen, foundOpen, lostClosed, foundClosed, totalClosed } = data.stats;
    if (typeof total !== 'number' || typeof lostOpen !== 'number' || typeof foundOpen !== 'number' ||
        typeof lostClosed !== 'number' || typeof foundClosed !== 'number' || typeof totalClosed !== 'number') {
      throw new Error('Missing one or more required metric fields in admin stats');
    }
    if (totalClosed !== lostClosed + foundClosed) {
      throw new Error('totalClosed must equal lostClosed + foundClosed');
    }
  });

  // 9. Admin Modify Status to 'open'
  await test('PATCH /api/admin/reports/:id (admin reopen status)', async () => {
    const res = await fetch(`${BASE_URL}/api/admin/reports/${createdReportId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': 'user_sarah_admin'
      },
      body: JSON.stringify({ status: 'open' })
    });
    const data = await res.json();
    if (data.report?.status !== 'open') throw new Error('Admin status update failed');
  });

  // 10. Search API
  await test('GET /api/search?q=Headphones', async () => {
    const res = await fetch(`${BASE_URL}/api/search?q=Headphones`);
    const data = await res.json();
    if (!Array.isArray(data.reports) || data.count === 0) throw new Error('Search for Headphones returned 0 items');
  });

  // 11. Delete Report
  await test('DELETE /api/reports/:id', async () => {
    const res = await fetch(`${BASE_URL}/api/reports/${createdReportId}`, {
      method: 'DELETE',
      headers: { 'x-user-id': 'user_alex' }
    });
    const data = await res.json();
    if (!data.success) throw new Error('Delete failed');
  });

  // 12. System Status (Firestore Storage Backend)
  await test('GET /api/system/status', async () => {
    const res = await fetch(`${BASE_URL}/api/system/status`);
    const data = await res.json();
    if (!data.database?.firebaseConnected) throw new Error('Expected Firebase Firestore connected');
  });

  console.log(`\n--- TEST RUN SUMMARY: ${passed} PASSED, ${failed} FAILED ---`);
  if (failed > 0) process.exit(1);
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
