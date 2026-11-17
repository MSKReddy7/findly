/**
 * FINDLY — Frontend Application Controller
 * Pure Cloud-First Firestore Architecture (No AI, Direct Phone Contact Only)
 */

// Application State
const state = {
  currentUser: null,
  activeView: 'home',
  reports: [],
  myReports: [],
  selectedReport: null,
  uploadedImageBase64: null,
  theme: 'dark',
  filters: {
    type: 'all',
    category: 'all',
    status: 'all',
    q: '',
    location: ''
  }
};

// Initial App Boot
document.addEventListener('DOMContentLoaded', async () => {
  initRouter();
  initTheme();
  initEventListeners();
  handleHashChange();
  try { await initAuth(); } catch (e) { console.warn('initAuth error:', e); }
  try { await loadReports(); } catch (e) { console.warn('loadReports error:', e); }
});

/* ==========================================================================
   0. THEME / DARK MODE (Default is Dark Mode)
   ========================================================================== */

function initTheme() {
  applyTheme(state.theme);
  const toggleBtn = document.getElementById('btn-theme-toggle');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', async () => {
      const newTheme = state.theme === 'dark' ? 'light' : 'dark';
      state.theme = newTheme;
      applyTheme(newTheme);
      showToast(`Switched to ${newTheme} mode`, 'info');
      await window.api.setSessionTheme(newTheme).catch(() => {});
    });
  }
}

function applyTheme(theme) {
  const root = document.documentElement;
  const sunIcon = document.getElementById('theme-icon-sun');
  const moonIcon = document.getElementById('theme-icon-moon');

  if (theme === 'dark') {
    root.classList.add('dark');
    if (sunIcon) sunIcon.classList.remove('hidden');
    if (moonIcon) moonIcon.classList.add('hidden');
  } else {
    root.classList.remove('dark');
    if (sunIcon) sunIcon.classList.add('hidden');
    if (moonIcon) moonIcon.classList.remove('hidden');
  }
}

/* ==========================================================================
   1. ROUTING & NAVIGATION
   ========================================================================== */

function initRouter() {
  window.addEventListener('hashchange', handleHashChange);
}

function handleHashChange() {
  const hash = window.location.hash.slice(1) || 'home';
  const [route, queryString] = hash.split('?');
  
  if (route === 'admin' && (!state.currentUser || state.currentUser.role !== 'admin')) {
    showToast('Admin privilege required to access moderation dashboard.', 'warning');
    window.location.hash = '#home';
    return;
  }

  state.activeView = route;
  document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden'));

  const targetView = document.getElementById(`view-${route}`);
  if (targetView) {
    targetView.classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  document.querySelectorAll('.nav-link').forEach(link => {
    if (link.getAttribute('data-nav') === route) {
      link.classList.add('text-indigo-600', 'dark:text-indigo-400', 'bg-slate-100', 'dark:bg-slate-800');
    } else {
      link.classList.remove('text-indigo-600', 'dark:text-indigo-400', 'bg-slate-100', 'dark:bg-slate-800');
    }
  });

  // Handle route-specific params
  if (route === 'report') {
    if (queryString) {
      const params = new URLSearchParams(queryString);
      const type = params.get('type');
      if (type) {
        const radio = document.querySelector(`input[name="reportType"][value="${type}"]`);
        if (radio) radio.checked = true;
      }
    }
    checkFoundKeywordMatches();
  }

  if (route === 'home') renderHomeReports();
  if (route === 'explore') applyExploreFilters();
  if (route === 'my-reports') renderMyReportsView();
  if (route === 'admin') renderAdminView();
}

/* ==========================================================================
   2. AUTHENTICATION & SESSION
   ========================================================================== */

async function initAuth() {
  const session = await window.api.initSession();
  if (session && session.user) {
    state.currentUser = session.user;
  } else {
    // Default to Alex Rivera demo user for instant seamless experience
    state.currentUser = {
      uid: 'user_alex',
      displayName: 'Alex Rivera',
      email: 'alex.rivera@campus.edu',
      phoneNumber: '+1 (555) 234-5678',
      role: 'user'
    };
    await window.api.setSessionUser(state.currentUser).catch(() => {});
  }
  if (session && session.theme) {
    state.theme = session.theme;
    applyTheme(state.theme);
  }
  updateUserUI();
}

function splitPhoneNumber(phoneStr) {
  if (!phoneStr) return { countryCode: '+91', number: '' };
  const clean = String(phoneStr).trim();
  const knownCodes = ['+91', '+1', '+44', '+61', '+81', '+49', '+33', '+971', '+65', '+86'];
  for (const code of knownCodes) {
    if (clean.startsWith(code)) {
      const remainingDigits = clean.slice(code.length).replace(/\D/g, '').slice(-10);
      return { countryCode: code, number: remainingDigits };
    }
  }
  const digits = clean.replace(/\D/g, '');
  if (digits.length >= 10) {
    return { countryCode: '+91', number: digits.slice(-10) };
  }
  return { countryCode: '+91', number: digits };
}

function updateUserUI() {
  const u = state.currentUser;
  const nameEl = document.getElementById('user-display-name');
  const avatarEl = document.getElementById('user-avatar');
  const dropdownName = document.getElementById('dropdown-name');
  const dropdownEmail = document.getElementById('dropdown-email');
  const adminNav = document.getElementById('nav-admin-link');
  const formPhone = document.getElementById('form-phone');
  const formCountry = document.getElementById('form-country-code');

  if (u) {
    if (nameEl) nameEl.textContent = u.displayName.split(' ')[0];
    if (avatarEl) {
      avatarEl.textContent = u.displayName.charAt(0).toUpperCase();
      avatarEl.className = u.role === 'admin' 
        ? 'flex h-6 w-6 items-center justify-center rounded-full bg-amber-500 text-white font-bold text-xs uppercase' 
        : 'flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-white font-bold text-xs uppercase';
    }
    if (dropdownName) dropdownName.textContent = u.displayName;
    if (dropdownEmail) dropdownEmail.textContent = u.email;

    if (adminNav) {
      if (u.role === 'admin') {
        adminNav.classList.remove('hidden');
      } else {
        adminNav.classList.add('hidden');
      }
    }

    if (formPhone && u.phoneNumber && !formPhone.value) {
      const parsed = splitPhoneNumber(u.phoneNumber);
      if (formCountry && parsed.countryCode) formCountry.value = parsed.countryCode;
      formPhone.value = parsed.number;
    }
  } else {
    if (nameEl) nameEl.textContent = 'Guest';
    if (avatarEl) {
      avatarEl.textContent = 'G';
      avatarEl.className = 'flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs uppercase';
    }
    if (dropdownName) dropdownName.textContent = 'Guest User';
    if (dropdownEmail) dropdownEmail.textContent = 'Sign in to post or contact';
    if (adminNav) adminNav.classList.add('hidden');
  }
}

window.switchDemoUser = async (uid) => {
  try {
    const res = await window.api.getUserList();
    const user = res.users.find(u => u.uid === uid);
    if (user) {
      state.currentUser = user;
      await window.api.setSessionUser(user);
      updateUserUI();
      closeUserMenu();
      showToast(`Switched account to ${user.displayName}`, 'success');

      // Crucial: Update Home, Explore, and My Items views immediately to respect ownership filters!
      renderHomeReports();
      if (state.activeView === 'explore') applyExploreFilters();
      if (state.activeView === 'my-reports') renderMyReportsView();
      if (state.activeView === 'admin') {
        if (user.role === 'admin') {
          renderAdminView();
        } else {
          window.location.hash = '#home';
        }
      }
    }
  } catch (err) {
    showToast('Failed switching user: ' + err.message, 'error');
  }
};

function closeUserMenu() {
  const dropdown = document.getElementById('user-dropdown');
  if (dropdown) dropdown.classList.add('hidden');
}

/* ==========================================================================
   3. REPORTS & HOME VIEW (Current user's items EXCLUDED)
   ========================================================================== */

async function loadReports() {
  try {
    const res = await window.api.getReports();
    state.reports = res.reports || [];
    renderHomeReports();
  } catch (err) {
    console.error('Error loading reports:', err);
  }
}

function renderHomeReports(filter = 'all') {
  const grid = document.getElementById('home-reports-grid');
  if (!grid) return;

  // RULE: Home page Recent Community Items MUST NOT contain items posted by current user!
  // RULE: Only open items are shown in recent community items!
  let filtered = (state.reports || []).filter(r => {
    const isOwner = state.currentUser && r.ownerId === state.currentUser.uid;
    const isOpen = (r.status || 'open') === 'open';
    return !isOwner && isOpen;
  });

  if (filter !== 'all') {
    filtered = filtered.filter(r => r.type === filter);
  }

  const displayItems = filtered.slice(0, 6);

  if (displayItems.length === 0) {
    grid.innerHTML = `
      <div class="col-span-full py-12 text-center text-slate-400 dark:text-slate-500">
        <p class="text-sm font-semibold">No community items available in this section.</p>
        <p class="text-xs mt-1">Your own posted items can be managed under "My Items".</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = displayItems.map(report => createReportCardHTML(report)).join('');
}

function createReportCardHTML(report) {
  const isLost = report.type === 'lost';
  const typeBadge = isLost
    ? `<span class="inline-flex items-center gap-1 rounded-full bg-rose-50 dark:bg-rose-950/80 px-2.5 py-0.5 text-xs font-bold text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900">🔴 Lost</span>`
    : `<span class="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-950/80 px-2.5 py-0.5 text-xs font-bold text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900">🟢 Found</span>`;

  const isOpen = (report.status || 'open') === 'open';
  const statusBadge = isOpen
    ? `<span class="rounded-full bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900">Open</span>`
    : `<span class="rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-slate-700 dark:text-slate-300">Closed</span>`;

  const imgUrl = (report.imageUrls && report.imageUrls[0]) || '';
  const imgElement = imgUrl
    ? `<img src="${imgUrl}" alt="${escapeHTML(report.title)}" class="h-44 w-full object-cover rounded-t-2xl">`
    : `<div class="h-44 w-full bg-slate-100 dark:bg-slate-800 rounded-t-2xl flex items-center justify-center text-4xl">📦</div>`;

  return `
    <div class="flex flex-col rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700 transition overflow-hidden group">
      <div class="relative overflow-hidden cursor-pointer" onclick="openDetailsModal('${report.id}')">
        ${imgElement}
        <div class="absolute top-3 left-3 flex gap-1.5">${typeBadge} ${statusBadge}</div>
      </div>
      <div class="p-4 flex-1 flex flex-col justify-between">
        <div>
          <span class="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">${escapeHTML(report.category || 'Item')}</span>
          <h3 class="font-bold text-slate-900 dark:text-white text-sm leading-snug line-clamp-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition cursor-pointer mt-0.5" onclick="openDetailsModal('${report.id}')">
            ${escapeHTML(report.title)}
          </h3>
          <p class="mt-1.5 text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
            ${escapeHTML(report.description)}
          </p>
        </div>
        <div class="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <span class="flex items-center gap-1 truncate max-w-[150px]">
            <span>📍</span>
            <span class="truncate">${escapeHTML(report.location || 'Campus')}</span>
          </span>
          <span class="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 cursor-pointer" onclick="openDetailsModal('${report.id}')">📞 View Contact &rarr;</span>
        </div>
      </div>
    </div>
  `;
}

/* ==========================================================================
   4. EXPLORE & BROWSE ALL (Current user's items EXCLUDED)
   ========================================================================== */

window.filterHomeReports = (type) => {
  document.querySelectorAll('.home-tab-btn').forEach(b => {
    if (b.getAttribute('data-filter') === type) {
      b.className = 'home-tab-btn active px-3.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 shadow-xs text-slate-900 dark:text-white';
    } else {
      b.className = 'home-tab-btn px-3.5 py-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white';
    }
  });
  renderHomeReports(type);
};

window.filterByCategory = (category) => {
  window.location.hash = '#explore';
  setTimeout(() => {
    const catSelect = document.getElementById('filter-category');
    if (catSelect) {
      catSelect.value = category;
      applyExploreFilters();
    }
  }, 50);
};

window.handleQuickSearch = (e) => {
  e.preventDefault();
  const q = document.getElementById('quick-search-input').value.trim();
  window.location.hash = '#explore';
  setTimeout(() => {
    const expInput = document.getElementById('explore-search-input');
    if (expInput) {
      expInput.value = q;
      applyExploreFilters();
    }
  }, 50);
};

async function applyExploreFilters() {
  const q = document.getElementById('explore-search-input')?.value.trim() || '';
  const type = document.getElementById('filter-type')?.value || 'all';
  const category = document.getElementById('filter-category')?.value || 'all';
  const status = document.getElementById('filter-status')?.value || 'all';
  const location = document.getElementById('filter-location')?.value.trim() || '';

  const params = {};
  if (q) params.q = q;
  if (type !== 'all') params.type = type;
  if (category !== 'all') params.category = category;
  if (status !== 'all') params.status = status;
  if (location) params.location = location;

  try {
    const res = await window.api.search(params);
    let items = res.reports || [];
    
    // RULE: In Browse All section, there should be NO products which user added!
    if (state.currentUser) {
      items = items.filter(r => r.ownerId !== state.currentUser.uid);
    }

    renderExploreGrid(items);
  } catch (err) {
    showToast('Search error: ' + err.message, 'error');
  }
}

function renderExploreView() {
  applyExploreFilters();
}

function renderExploreGrid(reports) {
  const grid = document.getElementById('explore-reports-grid');
  const countEl = document.getElementById('results-count');
  if (!grid) return;

  if (countEl) countEl.textContent = `Showing ${reports.length} community listing(s)`;

  if (reports.length === 0) {
    grid.innerHTML = `
      <div class="col-span-full py-16 text-center">
        <div class="text-4xl mb-2">🔍</div>
        <h3 class="text-base font-bold text-slate-800 dark:text-slate-200">No matching items found</h3>
        <p class="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">Items you posted are kept under "My Items". Try searching with different keywords.</p>
        <button onclick="resetExploreFilters()" class="mt-3 px-4 py-2 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-xl text-xs font-bold hover:bg-indigo-100">Clear Filters</button>
      </div>
    `;
    return;
  }

  grid.innerHTML = reports.map(r => createReportCardHTML(r)).join('');
}

window.resetExploreFilters = () => {
  const qEl = document.getElementById('explore-search-input');
  const typeEl = document.getElementById('filter-type');
  const catEl = document.getElementById('filter-category');
  const statEl = document.getElementById('filter-status');
  const locEl = document.getElementById('filter-location');

  if (qEl) qEl.value = '';
  if (typeEl) typeEl.value = 'all';
  if (catEl) catEl.value = 'all';
  if (statEl) statEl.value = 'all';
  if (locEl) locEl.value = '';

  applyExploreFilters();
};

/* ==========================================================================
   5. REPORT CREATION
   ========================================================================== */

function initReportForm() {
  const form = document.getElementById('report-form');
  const dropzone = document.getElementById('image-dropzone');
  const fileInput = document.getElementById('form-image-file');
  const removeImgBtn = document.getElementById('btn-remove-image');
  const titleInput = document.getElementById('form-title');

  const dateInput = document.getElementById('form-date');
  if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];

  // Restrict phone input to max 10 digits
  const phoneInput = document.getElementById('form-phone');
  if (phoneInput) {
    phoneInput.addEventListener('input', () => {
      phoneInput.value = phoneInput.value.replace(/\D/g, '').slice(0, 10);
    });
  }

  // Live keyword check: If user is adding a "lost" product, check if any "found" item has matching keywords
  if (titleInput) {
    titleInput.addEventListener('input', debounce(checkFoundKeywordMatches, 150));
  }
  document.querySelectorAll('input[name="reportType"]').forEach(radio => {
    radio.addEventListener('change', checkFoundKeywordMatches);
  });

  if (dropzone && fileInput && removeImgBtn) {
    dropzone.addEventListener('click', (e) => {
      if (e.target !== removeImgBtn && !removeImgBtn.contains(e.target)) {
        fileInput.click();
      }
    });

    fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) processImageFile(e.target.files[0]);
    });

    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('border-indigo-500', 'bg-indigo-50/20');
    });

    dropzone.addEventListener('dragleave', () => {
      dropzone.classList.remove('border-indigo-500', 'bg-indigo-50/20');
    });

    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('border-indigo-500', 'bg-indigo-50/20');
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        processImageFile(e.dataTransfer.files[0]);
      }
    });

    removeImgBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      state.uploadedImageBase64 = null;
      const preview = document.getElementById('image-preview');
      const container = document.getElementById('image-preview-container');
      const prompt = document.getElementById('dropzone-prompt');
      if (preview) preview.src = '';
      if (container) container.classList.add('hidden');
      if (prompt) prompt.classList.remove('hidden');
    });
  }

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      if (!state.currentUser) {
        showToast('Please sign in or select an account first.', 'warning');
        openAuthModal();
        return;
      }

      const type = document.querySelector('input[name="reportType"]:checked')?.value || 'lost';
      const title = document.getElementById('form-title').value.trim();
      const category = document.getElementById('form-category').value;
      const date = document.getElementById('form-date').value;
      const location = document.getElementById('form-location').value.trim();
      const description = (document.getElementById('form-description')?.value || '').trim();
      
      const countryCode = document.getElementById('form-country-code')?.value || '+91';
      const phoneDigits = (document.getElementById('form-phone')?.value || '').replace(/\D/g, '');

      // 10-digit check without country code
      if (phoneDigits.length !== 10) {
        showToast('Phone number must be exactly 10 digits without country code.', 'warning');
        document.getElementById('form-phone').focus();
        return;
      }

      const phoneNumber = `${countryCode} ${phoneDigits}`;

      const reportData = {
        type,
        title,
        category,
        date,
        location,
        description,
        phoneNumber,
        imageUrls: state.uploadedImageBase64 ? [state.uploadedImageBase64] : []
      };

      const submitBtn = document.getElementById('btn-submit-report');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Publishing item...';

      try {
        await window.api.createReport(reportData);
        showToast('Item posted successfully! Marked as Open.', 'success');
        form.reset();
        state.uploadedImageBase64 = null;
        document.getElementById('btn-remove-image')?.click();
        const hintEl = document.getElementById('found-match-hint');
        const buttonArea = document.getElementById('publish-button-area');
        if (hintEl) hintEl.classList.add('hidden');
        if (buttonArea) buttonArea.className = 'transition-all duration-300 rounded-2xl p-1';
        await loadReports();
        window.location.hash = '#my-reports';
      } catch (err) {
        showToast('Failed to post item: ' + err.message, 'error');
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Publish Item';
      }
    });
  }
}

function checkFoundKeywordMatches() {
  const typeRadio = document.querySelector('input[name="reportType"]:checked');
  const currentFormType = typeRadio ? typeRadio.value : 'lost';
  const oppositeType = currentFormType === 'lost' ? 'found' : 'lost';
  const titleInput = document.getElementById('form-title');
  const hintEl = document.getElementById('found-match-hint');
  const textEl = document.getElementById('found-match-text');
  const buttonArea = document.getElementById('publish-button-area');
  const redirectBtn = document.getElementById('btn-redirect-explore-match');

  if (!titleInput || !hintEl || !buttonArea) return;

  const titleText = titleInput.value.trim();
  if (!titleText) {
    hintEl.classList.add('hidden');
    buttonArea.className = 'transition-all duration-300 rounded-2xl p-1';
    return;
  }

  // Split name only by ' '
  const keywords = titleText.split(' ').map(w => w.trim().toLowerCase()).filter(w => w.length > 0);
  if (keywords.length === 0) {
    hintEl.classList.add('hidden');
    buttonArea.className = 'transition-all duration-300 rounded-2xl p-1';
    return;
  }

  // Check items of opposite type, status open, AND NOT posted by current user
  const allReports = state.reports || [];
  const currentUid = state.currentUser ? state.currentUser.uid : null;
  const matchingReports = allReports.filter(r => {
    if (currentUid && r.ownerId === currentUid) return false;
    if ((r.type || '').toLowerCase() !== oppositeType) return false;
    if ((r.status || 'open').toLowerCase() !== 'open') return false;
    const rTitle = (r.title || '').toLowerCase();
    return keywords.some(k => rTitle.includes(k));
  });

  if (matchingReports.length > 0) {
    const bestMatch = matchingReports[0];

    hintEl.classList.remove('hidden');
    buttonArea.className = 'transition-all duration-300 rounded-2xl p-3 border-2 border-dashed border-rose-500 bg-rose-50/40 dark:bg-rose-950/30 ring-4 ring-rose-500/20';

    if (textEl) {
      const typeLabel = oppositeType === 'found' ? 'found' : 'lost';
      textEl.innerHTML = `Someone posted a <strong>${typeLabel}</strong> item matching your keyword: <strong>"${escapeHTML(bestMatch.title)}"</strong> (📍 ${escapeHTML(bestMatch.location || 'Campus')}). Check if this matches before publishing!`;
    }

    if (redirectBtn) {
      redirectBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        window.location.hash = '#explore';
        setTimeout(() => {
          const exploreInput = document.getElementById('explore-search-input');
          const filterType = document.getElementById('filter-type');
          if (filterType) filterType.value = oppositeType;
          if (exploreInput) {
            exploreInput.value = titleText;
            applyExploreFilters();
          }
        }, 50);
      };
    }
  } else {
    hintEl.classList.add('hidden');
    buttonArea.className = 'transition-all duration-300 rounded-2xl p-1';
  }
}

function processImageFile(file) {
  if (!file.type.startsWith('image/')) {
    showToast('Please upload an image file (PNG, JPG, WebP)', 'error');
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    showToast('Image size exceeds 5MB limit', 'warning');
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    state.uploadedImageBase64 = e.target.result;
    const preview = document.getElementById('image-preview');
    const container = document.getElementById('image-preview-container');
    const prompt = document.getElementById('dropzone-prompt');
    if (preview) preview.src = state.uploadedImageBase64;
    if (container) container.classList.remove('hidden');
    if (prompt) prompt.classList.add('hidden');
  };
  reader.readAsDataURL(file);
}

/* ==========================================================================
   6. MY REPORTS (User-added products only visible here, toggle Open/Closed)
   ========================================================================== */

async function renderMyReportsView(filterStatus = 'all') {
  const grid = document.getElementById('my-reports-grid');
  if (!grid) return;

  if (!state.currentUser) {
    grid.innerHTML = `
      <div class="col-span-full py-16 text-center">
        <p class="text-sm font-bold text-slate-800 dark:text-slate-200">You are in Guest Mode</p>
        <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">Please sign in to view and manage your items.</p>
        <button onclick="openAuthModal()" class="mt-3 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold">Sign In</button>
      </div>
    `;
    return;
  }

  try {
    const res = await window.api.getReports({ ownerId: state.currentUser.uid });
    state.myReports = res.reports || [];

    let filtered = state.myReports;
    if (filterStatus !== 'all') {
      filtered = filtered.filter(r => (r.status || 'open').toLowerCase() === filterStatus.toLowerCase());
    }

    if (filtered.length === 0) {
      grid.innerHTML = `
        <div class="col-span-full py-16 text-center text-slate-400 dark:text-slate-500">
          <p class="text-sm font-bold text-slate-800 dark:text-slate-200">No items found</p>
          <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">You don't have any items under "${filterStatus}" status.</p>
          <a href="#report" class="mt-4 inline-block px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700">Post an Item</a>
        </div>
      `;
      return;
    }

    grid.innerHTML = filtered.map(r => createMyReportCardHTML(r)).join('');
  } catch (err) {
    showToast('Failed to load items: ' + err.message, 'error');
  }
}



function createMyReportCardHTML(report) {
  const isLost = report.type === 'lost';
  const typeBadge = isLost
    ? `<span class="rounded-full bg-rose-50 dark:bg-rose-950/80 px-2.5 py-0.5 text-xs font-bold text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900">🔴 Lost</span>`
    : `<span class="rounded-full bg-emerald-50 dark:bg-emerald-950/80 px-2.5 py-0.5 text-xs font-bold text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900">🟢 Found</span>`;

  const isOpen = (report.status || 'open') === 'open';
  const statusBadge = isOpen
    ? `<span class="rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 px-2.5 py-0.5 text-xs font-bold">🟢 Open</span>`
    : `<span class="rounded-full bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-300 px-2.5 py-0.5 text-xs font-bold">⚫ Closed</span>`;

  return `
    <div class="flex flex-col rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-2xs hover:border-slate-300 dark:hover:border-slate-700 transition">
      <div class="flex items-start justify-between gap-2 mb-2">
        <div class="flex items-center gap-1.5">${typeBadge} ${statusBadge}</div>
        <span class="text-[10px] text-slate-400 font-mono">${report.date || 'Recent'}</span>
      </div>

      <h3 class="font-bold text-slate-900 dark:text-white text-base leading-snug line-clamp-1 mt-1">${escapeHTML(report.title)}</h3>
      <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">${escapeHTML(report.category)} &bull; 📍 ${escapeHTML(report.location)}</p>
      
      <p class="text-xs text-slate-600 dark:text-slate-300 mt-2 line-clamp-2 leading-relaxed bg-slate-50 dark:bg-slate-800 p-2.5 rounded-xl">
        ${escapeHTML(report.description || 'No description')}
      </p>

      <!-- Contact Phone Info -->
      <div class="mt-3 p-2.5 bg-indigo-50/20 dark:bg-indigo-950/30 rounded-xl text-xs flex items-center justify-between">
        <span class="text-slate-500 dark:text-slate-400">Contact Phone:</span>
        <span class="font-bold font-mono text-indigo-700 dark:text-indigo-300">📞 ${escapeHTML(report.phoneNumber || 'None')}</span>
      </div>

      <!-- Action Controls (Toggle Open / Closed) -->
      <div class="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
        ${isOpen ? `
          <button onclick="toggleItemStatus('${report.id}', 'closed')" class="flex-1 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white text-xs font-bold transition flex items-center justify-center gap-1.5">
            <span>✓ Mark as Closed</span>
          </button>
        ` : `
          <button onclick="toggleItemStatus('${report.id}', 'open')" class="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center justify-center gap-1.5">
            <span>🔄 Reopen Listing</span>
          </button>
        `}
        <button onclick="openEditModal('${report.id}')" class="px-3 py-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl font-bold text-xs transition">Edit</button>
        <button onclick="deleteReportConfirm('${report.id}')" class="px-3 py-2 text-rose-600 dark:text-rose-400 hover:text-rose-800 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-xl font-bold text-xs transition">Delete</button>
      </div>
    </div>
  `;
}

window.filterMyReports = (status) => {
  document.querySelectorAll('.my-tab-btn').forEach(b => {
    if (b.getAttribute('data-status') === status) {
      b.className = 'my-tab-btn active px-3.5 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800';
    } else {
      b.className = 'my-tab-btn px-3.5 py-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800';
    }
  });
  renderMyReportsView(status);
};

window.toggleItemStatus = async (reportId, newStatus) => {
  try {
    await window.api.updateReport(reportId, { status: newStatus });
    showToast(`Listing marked as ${newStatus.toUpperCase()}`, 'success');
    await loadReports();
    renderMyReportsView();
  } catch (err) {
    showToast('Failed to update status: ' + err.message, 'error');
  }
};

window.deleteReportConfirm = async (reportId) => {
  if (!confirm('Are you sure you want to permanently delete this listing?')) return;
  try {
    await window.api.deleteReport(reportId);
    showToast('Listing removed', 'success');
    await loadReports();
    if (state.activeView === 'my-reports') renderMyReportsView();
    if (state.activeView === 'admin') renderAdminView();
  } catch (err) {
    showToast('Failed to delete: ' + err.message, 'error');
  }
};

/* ==========================================================================
   7. ITEM DETAILS MODAL (Poster info, User ID, and Direct Phone Call)
   ========================================================================== */

window.openDetailsModal = async (reportId) => {
  try {
    const res = await window.api.getReport(reportId);
    const r = res.report;
    state.selectedReport = r;

    document.getElementById('modal-details-title').textContent = r.title;
    document.getElementById('modal-details-category').textContent = r.category;
    document.getElementById('modal-details-location').textContent = `📍 ${r.location || 'Campus'}`;
    document.getElementById('modal-details-date').textContent = `📅 ${r.date || 'Recent'}`;
    
    // Poster Name and User ID
    document.getElementById('modal-details-owner').textContent = r.ownerName || 'Community Member';
    document.getElementById('modal-details-owner-id').textContent = r.ownerId || 'N/A';
    
    document.getElementById('modal-details-description').textContent = r.description;

    // Contact Phone Call Button
    const callLink = document.getElementById('modal-details-call-link');
    const callNum = document.getElementById('modal-details-call-number');
    if (callNum) callNum.textContent = r.phoneNumber || 'No phone provided';
    if (callLink) {
      if (r.phoneNumber) {
        callLink.href = `tel:${r.phoneNumber.replace(/[^\d+]/g, '')}`;
        callLink.classList.remove('pointer-events-none', 'opacity-50');
      } else {
        callLink.href = '#';
        callLink.classList.add('pointer-events-none', 'opacity-50');
      }
    }

    const isLost = r.type === 'lost';
    const isOpen = (r.status || 'open') === 'open';
    document.getElementById('modal-details-badges').innerHTML = `
      <span class="rounded-full ${isLost ? 'bg-rose-50 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-900' : 'bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900'} border px-2.5 py-0.5 text-xs font-bold uppercase">${r.type}</span>
      <span class="rounded-full ${isOpen ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'} border px-2.5 py-0.5 text-xs font-bold uppercase">${isOpen ? 'Open' : 'Closed'}</span>
    `;

    const imgContainer = document.getElementById('modal-details-images');
    if (r.imageUrls && r.imageUrls.length > 0) {
      imgContainer.innerHTML = `<img src="${r.imageUrls[0]}" alt="${escapeHTML(r.title)}" class="w-full max-h-64 object-cover rounded-2xl shadow-xs">`;
      imgContainer.classList.remove('hidden');
    } else {
      imgContainer.classList.add('hidden');
    }

    document.getElementById('modal-details').classList.remove('hidden');
  } catch (err) {
    showToast('Failed to open details: ' + err.message, 'error');
  }
};

window.closeDetailsModal = () => {
  document.getElementById('modal-details').classList.add('hidden');
};

/* ==========================================================================
   8. EDIT REPORT MODAL
   ========================================================================== */

window.openEditModal = async (reportId) => {
  try {
    const res = await window.api.getReport(reportId);
    const r = res.report;

    document.getElementById('edit-report-id').value = r.id;
    document.getElementById('edit-title').value = r.title;
    document.getElementById('edit-category').value = r.category;
    document.getElementById('edit-status').value = r.status || 'open';
    
    // Split phone number into country code and 10 digits
    const parsed = splitPhoneNumber(r.phoneNumber);
    const editCountry = document.getElementById('edit-country-code');
    const editPhone = document.getElementById('edit-phone');
    if (editCountry && parsed.countryCode) editCountry.value = parsed.countryCode;
    if (editPhone) editPhone.value = parsed.number;

    document.getElementById('edit-location').value = r.location;
    document.getElementById('edit-description').value = r.description || '';

    document.getElementById('modal-edit-report').classList.remove('hidden');
  } catch (err) {
    showToast('Failed to open edit modal: ' + err.message, 'error');
  }
};

window.closeEditModal = () => {
  document.getElementById('modal-edit-report').classList.add('hidden');
};

function initEditReportForm() {
  const form = document.getElementById('edit-report-form');
  const editPhoneInput = document.getElementById('edit-phone');
  if (editPhoneInput) {
    editPhoneInput.addEventListener('input', () => {
      editPhoneInput.value = editPhoneInput.value.replace(/\D/g, '').slice(0, 10);
    });
  }

  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('edit-report-id').value;
    const title = document.getElementById('edit-title').value.trim();
    const category = document.getElementById('edit-category').value;
    const status = document.getElementById('edit-status').value;
    
    const countryCode = document.getElementById('edit-country-code')?.value || '+91';
    const phoneDigits = (document.getElementById('edit-phone')?.value || '').replace(/\D/g, '');

    // 10-digit check without country code
    if (phoneDigits.length !== 10) {
      showToast('Phone number must be exactly 10 digits without country code.', 'warning');
      document.getElementById('edit-phone').focus();
      return;
    }

    const phoneNumber = `${countryCode} ${phoneDigits}`;
    const location = document.getElementById('edit-location').value.trim();
    const description = (document.getElementById('edit-description')?.value || '').trim();

    try {
      await window.api.updateReport(id, { title, category, status, phoneNumber, location, description });
      showToast('Changes saved successfully!', 'success');
      closeEditModal();
      await loadReports();
      renderMyReportsView();
    } catch (err) {
      showToast('Failed to save changes: ' + err.message, 'error');
    }
  });
}

/* ==========================================================================
   9. ADMIN DASHBOARD & INVENTORY MONITORING
   ========================================================================== */

async function renderAdminView() {
  if (!state.currentUser || state.currentUser.role !== 'admin') return;

  try {
    // 1. Fetch exact admin statistics computed in store.js
    const statsRes = await window.api.getAdminStats();
    const stats = statsRes.stats || {};

    const lostOpenEl = document.getElementById('admin-lost-open');
    const foundOpenEl = document.getElementById('admin-found-open');
    const lostClosedEl = document.getElementById('admin-lost-closed');
    const foundClosedEl = document.getElementById('admin-found-closed');
    const totalClosedEl = document.getElementById('admin-total-closed');
    const totalItemsEl = document.getElementById('admin-total-items');

    if (lostOpenEl) lostOpenEl.textContent = stats.lostOpen ?? 0;
    if (foundOpenEl) foundOpenEl.textContent = stats.foundOpen ?? 0;
    if (lostClosedEl) lostClosedEl.textContent = stats.lostClosed ?? 0;
    if (foundClosedEl) foundClosedEl.textContent = stats.foundClosed ?? 0;
    if (totalClosedEl) totalClosedEl.textContent = stats.totalClosed ?? 0;
    if (totalItemsEl) totalItemsEl.textContent = stats.total ?? 0;

    // 2. Fetch all reports for the moderation table
    const reportsRes = await window.api.getReports();
    const allReports = reportsRes.reports || [];

    const table = document.getElementById('admin-reports-table');
    if (!table) return;

    if (allReports.length === 0) {
      table.innerHTML = `<tr><td colspan="7" class="p-6 text-center text-slate-400">No listings found in the database.</td></tr>`;
      return;
    }

    table.innerHTML = allReports.map(r => {
      const isOpen = (r.status || 'open') === 'open';
      return `
        <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
          <td class="p-3 font-semibold text-slate-900 dark:text-white">
            <div class="font-bold">${escapeHTML(r.title)}</div>
            <div class="text-[10px] text-slate-400 uppercase">${escapeHTML(r.category)}</div>
          </td>
          <td class="p-3">
            <span class="px-2 py-0.5 rounded text-[10px] font-bold ${r.type === 'lost' ? 'bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-300' : 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'}">
              ${r.type.toUpperCase()}
            </span>
          </td>
          <td class="p-3 text-slate-600 dark:text-slate-300">
            <div class="font-bold">${escapeHTML(r.ownerName || 'User')}</div>
            <div class="text-[10px] font-mono text-indigo-500">${escapeHTML(r.ownerId || 'N/A')}</div>
          </td>
          <td class="p-3 font-mono text-xs">
            ${r.phoneNumber ? `<a href="tel:${r.phoneNumber}" class="text-indigo-600 dark:text-indigo-400 font-bold hover:underline">📞 ${escapeHTML(r.phoneNumber)}</a>` : '<span class="text-slate-400">None</span>'}
          </td>
          <td class="p-3 text-slate-500 dark:text-slate-400">
            <div>${escapeHTML(r.location)}</div>
            <div class="text-[10px]">${escapeHTML(r.date)}</div>
          </td>
          <td class="p-3">
            <span class="px-2 py-0.5 rounded text-[10px] font-bold ${isOpen ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-300'}">
              ${isOpen ? 'OPEN' : 'CLOSED'}
            </span>
          </td>
          <td class="p-3 text-right">
            <div class="inline-flex items-center gap-1.5">
              <button onclick="adminChangeStatus('${r.id}', '${isOpen ? 'closed' : 'open'}')" class="px-2.5 py-1 text-xs font-bold rounded-lg ${isOpen ? 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300' : 'bg-emerald-600 text-white hover:bg-emerald-700'} transition">
                ${isOpen ? 'Mark Closed' : 'Mark Open'}
              </button>
              <button onclick="deleteReportConfirm('${r.id}')" class="p-1 text-rose-500 hover:text-rose-700 rounded hover:bg-rose-50 dark:hover:bg-rose-950/40" title="Delete listing">
                🗑️
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    showToast('Failed to load admin panel: ' + err.message, 'error');
  }
}

window.adminChangeStatus = async (reportId, newStatus) => {
  try {
    await window.api.adminUpdateReportStatus(reportId, newStatus);
    showToast(`Listing status updated to ${newStatus.toUpperCase()}`, 'success');
    await loadReports();
    renderAdminView();
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  }
};

/* ==========================================================================
   10. CUSTOM AUTH MODAL
   ========================================================================== */

function initAuthModal() {
  const customAuthBtn = document.getElementById('btn-custom-auth');
  const signOutBtn = document.getElementById('btn-sign-out');
  const loginForm = document.getElementById('login-form');
  const regForm = document.getElementById('register-form');

  if (customAuthBtn) {
    customAuthBtn.addEventListener('click', () => {
      closeUserMenu();
      openAuthModal();
    });
  }

  if (signOutBtn) {
    signOutBtn.addEventListener('click', () => {
      window.api.logout();
      state.currentUser = null;
      updateUserUI();
      closeUserMenu();
      showToast('Signed out.', 'info');
      renderHomeReports();
      if (state.activeView === 'my-reports' || state.activeView === 'admin') {
        window.location.hash = '#home';
      }
    });
  }

  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('login-email').value.trim();
      try {
        const res = await window.api.login(email);
        state.currentUser = res.user;
        updateUserUI();
        closeAuthModal();
        showToast(`Welcome back, ${res.user.displayName}!`, 'success');
        renderHomeReports();
        if (state.activeView === 'my-reports') renderMyReportsView();
      } catch (err) {
        showToast('Login error: ' + err.message, 'error');
      }
    });
  }

  if (regForm) {
    regForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('reg-name').value.trim();
      const email = document.getElementById('reg-email').value.trim();
      const role = document.getElementById('reg-role').value;

      try {
        const res = await window.api.register(name, email, role);
        state.currentUser = res.user;
        updateUserUI();
        closeAuthModal();
        showToast(`Welcome, ${res.user.displayName}!`, 'success');
        renderHomeReports();
      } catch (err) {
        showToast('Registration error: ' + err.message, 'error');
      }
    });
  }
}

window.openAuthModal = () => {
  document.getElementById('modal-auth')?.classList.remove('hidden');
};

window.closeAuthModal = () => {
  document.getElementById('modal-auth')?.classList.add('hidden');
};

window.toggleAuthTab = (tab) => {
  const loginForm = document.getElementById('login-form');
  const regForm = document.getElementById('register-form');
  const loginTab = document.getElementById('auth-tab-login');
  const regTab = document.getElementById('auth-tab-register');
  const title = document.getElementById('auth-modal-title');

  if (tab === 'login') {
    loginForm?.classList.remove('hidden');
    regForm?.classList.add('hidden');
    if (loginTab) loginTab.className = 'flex-1 py-2 border-b-2 border-indigo-600 text-indigo-600 dark:text-indigo-400';
    if (regTab) regTab.className = 'flex-1 py-2 border-b-2 border-transparent text-slate-500 dark:text-slate-400';
    if (title) title.textContent = 'Sign In';
  } else {
    loginForm?.classList.add('hidden');
    regForm?.classList.remove('hidden');
    if (loginTab) loginTab.className = 'flex-1 py-2 border-b-2 border-transparent text-slate-500 dark:text-slate-400';
    if (regTab) regTab.className = 'flex-1 py-2 border-b-2 border-indigo-600 text-indigo-600 dark:text-indigo-400';
    if (title) title.textContent = 'Create Account';
  }
};

/* ==========================================================================
   11. EVENT LISTENERS
   ========================================================================== */

function initEventListeners() {
  const userMenuBtn = document.getElementById('btn-user-menu');
  const userDropdown = document.getElementById('user-dropdown');
  if (userMenuBtn && userDropdown) {
    userMenuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      userDropdown.classList.toggle('hidden');
    });

    document.addEventListener('click', (e) => {
      if (!userMenuBtn.contains(e.target) && !userDropdown.contains(e.target)) {
        userDropdown.classList.add('hidden');
      }
    });
  }

  const settingsBtn = document.getElementById('btn-open-settings');
  if (settingsBtn) settingsBtn.addEventListener('click', openSettingsModal);

  ['explore-search-input', 'filter-type', 'filter-category', 'filter-status', 'filter-location'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', debounce(applyExploreFilters, 250));
      el.addEventListener('change', applyExploreFilters);
    }
  });

  initReportForm();
  initEditReportForm();
  initAuthModal();
}

window.openSettingsModal = async () => {
  const modal = document.getElementById('modal-settings');
  if (modal) modal.classList.remove('hidden');
  try {
    const status = await window.api.getSystemStatus();
    const dbBadge = document.getElementById('settings-db-badge');
    const dbType = document.getElementById('settings-db-type');
    if (status.database && dbBadge) {
      dbBadge.textContent = status.database.firebaseConnected ? 'Cloud Firestore Connected' : 'Connecting...';
      dbBadge.className = 'px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300';
      if (dbType) dbType.innerHTML = `Firebase Project: <code class="font-mono text-emerald-600">${status.database.firebaseProjectId || 'unknown'}</code>`;
    }
  } catch (err) {
    console.warn('Status error:', err);
  }
};

window.closeSettingsModal = () => {
  const modal = document.getElementById('modal-settings');
  if (modal) modal.classList.add('hidden');
};

/* ==========================================================================
   12. UTILITIES & TOASTS
   ========================================================================== */

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  const typeStyles = {
    success: 'bg-emerald-600 text-white',
    error: 'bg-rose-600 text-white',
    warning: 'bg-amber-500 text-white',
    info: 'bg-slate-900 dark:bg-slate-800 text-white border border-slate-700'
  }[type] || 'bg-slate-900 text-white';

  toast.className = `pointer-events-auto flex items-center gap-2 rounded-2xl px-4 py-3 text-xs font-bold shadow-2xl transition-all duration-300 transform -translate-y-2 opacity-0 ${typeStyles}`;
  toast.innerHTML = `<span>${escapeHTML(message)}</span>`;

  container.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.remove('-translate-y-2', 'opacity-0');
  });

  setTimeout(() => {
    toast.classList.add('opacity-0', '-translate-y-2');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

function debounce(fn, ms) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), ms);
  };
}

function escapeHTML(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/[&<>'"]/g, 
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
}
