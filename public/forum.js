// ============================================================
// forum.js — Community Forum (frontend)
// ============================================================

const user = JSON.parse(localStorage.getItem("user"));
const userId = user?.id || null;

if (user) {
    const dropdown = document.getElementById('user-dropdown');
    if (dropdown) {
        dropdown.innerHTML = `
            <img src="https://ui-avatars.com/api/?name=${user.firstname || user.firstName || 'U'}+${user.lastname || user.lastName || ''}&background=8B5FBF&color=fff" alt="User" class="user-avatar" id="user-avatar">
            <span id="instructorName">${user.firstname || user.firstName || 'User'}</span>
            <div class="dropdown-content">
                <a href="profile.html">Profile</a>
                <a href="settings.html">Settings</a>
                <a href="#" class="logout" onclick="logout()">Logout</a>
            </div>
        `;
    }
}

async function logout() {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    window.location.href = "/";
}

const forumUI = {
    state: { category: "", search: "", sort: "recent" },

    headers(json = false) {
        const h = {};
        const token = localStorage.getItem('token');
        if (token) h['Authorization'] = `Bearer ${token}`;
        if (json) h['Content-Type'] = 'application/json';
        return h;
    },

    async init() {
        try {
            const results = await Promise.allSettled([
                this.loadStats(),
                this.loadCategories(),
                this.loadTopics(),
                this.loadActivity()
            ]);
            const failures = results.filter(r => r.status === 'rejected');
            if (failures.length) {
                console.error('Some forum loaders failed:', failures);
                this.showInitError(failures.map(f => f.reason?.message || 'Unknown').join(' • '));
            }
            this.setupEventListeners();
        } catch (err) {
            console.error('Forum init failed:', err);
            this.showInitError(err.message);
        }
    },

    showInitError(detail) {
        const container = document.querySelector('.forum-main');
        if (!container || container.querySelector('.forum-init-error')) return;
        container.insertAdjacentHTML('afterbegin', `
            <div class="forum-init-error" style="background:#fee2e2; color:#991b1b; padding:16px; border-radius:8px; margin-bottom:16px; border:1px solid #fecaca;">
                ⚠️ Could not fully load the forum. ${detail ? 'Details: ' + detail : 'Please refresh.'}
            </div>
        `);
    },

    setupEventListeners() {
        const newTopicBtn = document.getElementById('newTopicBtn');
        if (newTopicBtn) newTopicBtn.addEventListener('click', () => this.openNewTopicModal());

        const searchInput = document.getElementById('forumSearch');
        const searchBtn = document.querySelector('.search-btn');
        if (searchInput && searchBtn) {
            const perform = () => { this.state.search = searchInput.value.trim(); this.loadTopics(); };
            searchBtn.addEventListener('click', perform);
            searchInput.addEventListener('keypress', e => { if (e.key === 'Enter') perform(); });
            let t = null;
            searchInput.addEventListener('input', e => {
                clearTimeout(t);
                t = setTimeout(() => { this.state.search = e.target.value.trim(); this.loadTopics(); }, 350);
            });
        }

        const sortSelect = document.getElementById('sortTopics');
        if (sortSelect) {
            sortSelect.addEventListener('change', e => {
                this.state.sort = e.target.value;
                this.loadTopics();
            });
        }

        const newTopicForm = document.getElementById('newTopicForm');
        if (newTopicForm) {
            newTopicForm.addEventListener('submit', async e => {
                e.preventDefault();
                const title = document.getElementById('topicTitle')?.value?.trim();
                const content = document.getElementById('topicContent')?.value?.trim();
                const categoryId = document.getElementById('topicCategory')?.value;
                const tags = (document.getElementById('topicTags')?.value || '')
                    .split(',').map(t => t.trim()).filter(Boolean);

                if (!title || !content || !categoryId) {
                    this.showMessage('Please fill in title, category, and content.', 'error');
                    return;
                }
                const ok = await this.createTopic({ title, content, categoryId, tags });
                if (ok) this.closeModal('newTopicModal');
            });
        }

        document.querySelectorAll('.editor-btn').forEach(btn => {
            btn.addEventListener('click', e => this.formatText(e.currentTarget.dataset.format));
        });
        document.querySelectorAll('.close-modal').forEach(btn => {
            btn.addEventListener('click', () => this.closeModal('newTopicModal'));
        });
        window.addEventListener('click', e => {
            if (e.target.classList?.contains('modal')) e.target.style.display = 'none';
        });
    },

    async loadStats() {
        const res = await fetch("https://fissk-iui2.onrender.com/forum-api/stats", { headers: this.headers() });
        if (!res.ok) throw new Error(`Stats: ${res.status}`);
        const stats = await res.json();
        const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v ?? 0; };
        set('totalTopics', stats.totalTopics);
        set('totalUsers', stats.totalUsers);
        set('totalReplies', stats.totalReplies);
        set('solvedTopics', stats.solvedTopics);
    },

    async loadCategories() {
        const res = await fetch("https://fissk-iui2.onrender.com/forum-api/categories", { headers: this.headers() });
        if (!res.ok) throw new Error(`Categories: ${res.status}`);
        const cats = await res.json();
        if (!Array.isArray(cats)) throw new Error('Categories: not an array');

        const list = document.getElementById('categoriesList');
        if (list) {
            list.innerHTML = cats.length === 0
                ? `<div class="no-content"><p>No categories yet.</p></div>`
                : cats.map(c => `
                    <div class="category-card" onclick="forumUI.setCategory('${c.slug}')">
                        <div class="category-icon">${c.icon || '📌'}</div>
                        <div class="category-info">
                            <h4>${c.name}</h4>
                            <p>${c.description || ''}</p>
                        </div>
                    </div>
                `).join('');
        }

        const select = document.getElementById('topicCategory');
        if (select) {
            select.innerHTML =
                `<option value="">Select category</option>` +
                cats.map(c => `<option value="${c._id}">${c.icon || '📌'} ${c.name}</option>`).join('');
        }
    },

    async loadCategoriesForSelect() {
        try {
            const res = await fetch('https://fissk-iui2.onrender.com/forum-api/categories', { headers: this.headers() });
            if (!res.ok) return;
            const cats = await res.json();
            const select = document.getElementById('topicCategory');
            if (select && Array.isArray(cats)) {
                select.innerHTML = cats.map(c => `<option value="${c._id}">${c.icon || '📌'} ${c.name}</option>`).join('');
            }
        } catch (err) { console.error('Load categories for select error:', err); }
    },

    setCategory(slug) {
        this.state.category = slug || "";
        this.loadTopics();
    },

    async loadTopics() {
        const { search, sort, category } = this.state;
        const params = new URLSearchParams({
            search: search || '',
            sort: sort || 'recent',
            category: category || ''
        });

        const res = await fetch(
            `https://fissk-iui2.onrender.com/forum-api/topics?${params.toString()}`,
            { headers: this.headers() }
        );
        if (!res.ok) throw new Error(`Topics: ${res.status}`);
        const topics = await res.json();
        if (!Array.isArray(topics)) throw new Error('Topics: not an array');

        const list = document.getElementById('topicsList');
        if (!list) return;

        if (topics.length === 0) {
            list.innerHTML = `
                <div class="no-content">
                    <p>No global discussions yet.</p>
                    <p style="font-size:0.9rem;color:#6B7280;margin:8px 0 16px;">
                        Looking for your class discussions? Open a class and click the <strong>Forum</strong> tab — those discussions are private to enrolled students.
                    </p>
                    <button class="btn btn-primary" onclick="forumUI.openNewTopicModal()">Start a Global Discussion</button>
                </div>
            `;
            return;
        }

        list.innerHTML = topics.map(t => {
            const replyCount = t.replyCount ?? (Array.isArray(t.replies) ? t.replies.length : 0);
            const categoryName = t.category_name || 'General';
            const author = t.author_name ? `by ${this.escapeHtml(t.author_name)}` : '';
            return `
                <div class="topic-item">
                    <div class="topic-left">
                        <h3>
                            ${t.isPinned ? '📌 ' : ''}${t.solved ? '✅ ' : ''}
                            ${this.escapeHtml(t.title)}
                        </h3>
                        <div class="topic-meta">
                            <span>${this.escapeHtml(categoryName)}</span>
                            ${author ? `<span>${author}</span>` : ''}
                            <span>💬 ${replyCount}</span>
                            <span>👀 ${t.views || 0}</span>
                        </div>
                    </div>
                    <a href="forum-post.html?id=${t._id}" class="btn btn-outline">View</a>
                </div>
            `;
        }).join('');
    },

    async loadActivity() {
        const recentActivity = document.getElementById('recentActivity');
        if (!userId) {
            if (recentActivity) recentActivity.innerHTML = `<p style="color:#6B7280;font-size:0.9rem;">Log in to see your activity.</p>`;
            return;
        }

        const res = await fetch(
            `https://fissk-iui2.onrender.com/forum-api/activity/${userId}`,
            { headers: this.headers() }
        );
        if (!res.ok) throw new Error(`Activity: ${res.status}`);
        const data = await res.json();

        const topicCount = Array.isArray(data.topics) ? data.topics.length : 0;
        const replyCount = Array.isArray(data.replies) ? data.replies.length : 0;

        if (recentActivity) {
            recentActivity.innerHTML = `
                <div class="activity-item"><strong>Your Topics</strong><span>${topicCount}</span></div>
                <div class="activity-item"><strong>Your Replies</strong><span>${replyCount}</span></div>
            `;
        }
    },

    async openNewTopicModal() {
        if (!userId) { this.showMessage('Please log in to start a discussion.', 'error'); return; }
        await this.loadCategoriesForSelect();
        const m = document.getElementById('newTopicModal');
        if (m) m.style.display = 'flex';
    },

    closeModal(id) {
        const m = document.getElementById(id);
        if (m) m.style.display = 'none';
    },

    async createTopic(payload) {
        if (!userId) { this.showMessage('Please log in to post.', 'error'); return false; }
        try {
            const res = await fetch("https://fissk-iui2.onrender.com/forum-api/topics", {
                method: "POST",
                headers: this.headers(true),
                body: JSON.stringify({
                    title: payload.title,
                    content: payload.content,
                    categoryId: payload.categoryId,
                    tags: payload.tags || [],
                    userId
                })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                this.showMessage(data.message || 'Failed to create topic.', 'error');
                return false;
            }
            this.showMessage('Discussion created!', 'success');
            await Promise.allSettled([this.loadTopics(), this.loadStats(), this.loadActivity()]);
            return true;
        } catch (err) {
            console.error('createTopic error:', err);
            this.showMessage('Network error while creating topic.', 'error');
            return false;
        }
    },

    formatText(format) {
        const ta = document.getElementById('topicContent');
        if (!ta) return;
        const start = ta.selectionStart, end = ta.selectionEnd;
        const sel = ta.value.substring(start, end);
        const map = { bold: `**${sel}**`, italic: `*${sel}*`, code: `\`${sel}\``, link: `[${sel}](url)` };
        const formatted = map[format];
        if (!formatted) return;
        ta.value = ta.value.substring(0, start) + formatted + ta.value.substring(end);
        ta.focus();
        const pos = start + formatted.length;
        ta.setSelectionRange(pos, pos);
    },

    showMessage(message, type = 'success') {
        const el = document.createElement('div');
        el.className = `forum-message forum-message-${type}`;
        el.textContent = message;
        el.style.cssText = `
            position:fixed;top:20px;right:20px;padding:15px 20px;border-radius:10px;
            color:white;background:${type === 'success' ? '#48BB78' : '#F56565'};
            z-index:10000;box-shadow:0 5px 15px rgba(0,0,0,0.2);max-width:400px;`;
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 3000);
    },

    escapeHtml(s) {
        if (s == null) return '';
        return String(s).replace(/[&<>"']/g, ch => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[ch]));
    }
};

document.addEventListener("DOMContentLoaded", () => forumUI.init());

const hamburger = document.querySelector('.hamburger');
const navMenu = document.querySelector('.nav-menu');
if (hamburger && navMenu) {
    hamburger.addEventListener('click', () => {
        hamburger.classList.toggle('active');
        navMenu.classList.toggle('active');
        if (navMenu.classList.contains('active')) {
            navMenu.style.display = 'flex';
            document.body.style.overflow = 'hidden';
        } else {
            navMenu.style.display = 'none';
            document.body.style.overflow = 'auto';
        }
    });
}
document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
        if (hamburger) hamburger.classList.remove('active');
        if (navMenu) navMenu.classList.remove('active');
        document.body.style.overflow = 'auto';
    });
});