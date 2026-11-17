/**
 * FINDLY Client API Layer
 * Connects frontend UI to backend REST endpoints.
 * No AI — pure Firestore cloud-first backend.
 */

class ApiService {
  constructor() {
    this.baseUrl = '';
    this.currentUser = null;
    this.sessionTheme = 'dark';
  }

  async initSession() {
    try {
      const res = await this.request('/api/session');
      if (res.user) this.currentUser = res.user;
      if (res.theme) this.sessionTheme = res.theme;
      return res;
    } catch (e) {
      return { user: this.currentUser, theme: 'dark' };
    }
  }

  async setSessionUser(user) {
    this.currentUser = user;
    try {
      return await this.request('/api/session/user', { method: 'POST', body: JSON.stringify({ user }) });
    } catch (e) { return { ok: true }; }
  }

  async setSessionTheme(theme) {
    this.sessionTheme = theme;
    try {
      return await this.request('/api/session/theme', { method: 'POST', body: JSON.stringify({ theme }) });
    } catch (e) { return { ok: true }; }
  }

  setCurrentUser(user) {
    this.currentUser = user;
    this.setSessionUser(user).catch(() => {});
  }

  getCurrentUser() { return this.currentUser; }

  getHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    if (this.currentUser && this.currentUser.uid) headers['x-user-id'] = this.currentUser.uid;
    return headers;
  }

  async request(endpoint, options = {}) {
    const config = { ...options, headers: { ...this.getHeaders(), ...(options.headers || {}) } };
    try {
      const res = await fetch(`${this.baseUrl}${endpoint}`, config);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP error ${res.status}`);
      return data;
    } catch (err) {
      console.error(`API Error on ${endpoint}:`, err);
      throw err;
    }
  }

  // Auth
  async getMe() { return this.request('/api/users/me'); }

  async login(email) {
    const res = await this.request('/api/auth/login', { method: 'POST', body: JSON.stringify({ email }) });
    this.setCurrentUser(res.user);
    return res;
  }

  async register(displayName, email, role = 'user') {
    const res = await this.request('/api/auth/register', { method: 'POST', body: JSON.stringify({ displayName, email, role }) });
    this.setCurrentUser(res.user);
    return res;
  }

  async getUserList() { return this.request('/api/users/list'); }

  logout() { this.setCurrentUser(null); }

  // Reports
  async getReports(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/api/reports${query ? '?' + query : ''}`);
  }

  async getReport(id) { return this.request(`/api/reports/${id}`); }

  async createReport(reportData) {
    return this.request('/api/reports', { method: 'POST', body: JSON.stringify(reportData) });
  }

  async updateReport(id, reportData) {
    return this.request(`/api/reports/${id}`, { method: 'PATCH', body: JSON.stringify(reportData) });
  }

  async deleteReport(id) {
    return this.request(`/api/reports/${id}`, { method: 'DELETE' });
  }

  // Search
  async search(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/api/search${query ? '?' + query : ''}`);
  }

  // System
  async getSystemStatus() { return this.request('/api/system/status'); }

  // Admin
  async adminUpdateReportStatus(reportId, status) {
    return this.request(`/api/admin/reports/${reportId}`, { method: 'PATCH', body: JSON.stringify({ status }) });
  }

  async getAdminStats() {
    return this.request('/api/admin/stats');
  }
}

window.api = new ApiService();
