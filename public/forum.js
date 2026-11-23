// ============================================================
// forum.js — Community Forum (frontend)
// Fixed: CORS preflight, silent init failures, double listeners,
//        missing response guards, broken activity HTML.
// ============================================================

const user = JSON.parse(localStorage.getItem("user"));
const userId = user?.id || null;

// ===== USER DROPDOWN =====
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

// ===== FORUM UI CONTROLLER =====
const forumUI = {
    state: {
        category: "",
        search: "",
        sort: "recent"
    },

    /**
     * Headers for every request.
     * NOTE: we DO NOT send a custom `userId` header anymore — that
     * triggered CORS preflight and broke cross-origin requests.
     * If you ever enable auth on forum routes, the Authorization
     * header below is already in place.
     */
    headers(json = false) {
        const h = {};
        const token = localStorage.getItem('token');
        if (token) h['Authorization'] = `Bearer ${token}`;
        if (json) h['Content-Type'] = 'application/json';
        return h;
    },

    async init() {
        try {
            // Use allSettled so one failing loader doesn't kill the others
            const results = await Promise.allSettled([
                this.loadStats(),
                this.loadCategories(),
                this.loadTopics(),
                this.loadActivity()
            ]);

            const failures = results.filter(r => r.status === 'rejected');
            if (failures.length > 0) {
                console.error('Some forum loaders failed:', failures);
                this.showInitError(failures.map(f => f.reason?.message || 'Unknown error').join(' • '));
            }

            this.setupEventListeners();
        } catch (err) {
            console.error('Forum init failed:', err);
            this.showInitError(err.message || 'Unknown error');
        }
    },

    showInitError(detail) {
        const container = document.querySelector('.forum-main');
        if (!container) return;
        if (container.querySelector('.forum-init-error')) return;
        container.insertAdjacentHTML('afterbegin', `
            <div class="forum-init-error" style="background:#fee2e2; color:#991b1b; padding:16px; border-radius:8px; margin-bottom:16px; border:1px solid #fecaca;">
                ⚠️ Could not fully load the forum. ${detail ? 'Details: ' + detail : 'Please refresh the page.'}
            </div>
        `);
    },

    setupEventListeners() {
        // New topic button
        const newTopicBtn = document.getElementById('newTopicBtn');
        if (newTopicBtn) {
            newTopicBtn.addEventListener('click', () => this.openNewTopicModal());
        }

        // Search
        const searchInput = document.getElementById('forumSearch');
        const searchBtn = document.querySelector('.search-btn');
        if (searchInput && searchBtn) {
            const performSearch = () => {
                this.state.search = searchInput.value.trim();
                this.loadTopics();
            };
            searchBtn.addEventListener('click', performSearch);
            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') performSearch();
            });
            // Debounced live search
            let searchTimer = null;
            searchInput.addEventListener('input', (e) => {
                clearTimeout(searchTimer);
                searchTimer = setTimeout(() => {
                    this.state.search = e.target.value.trim();
                    this.loadTopics();
                }, 350);
            });
        }

        // Sort
        const sortSelect = document.getElementById('sortTopics');
        if (sortSelect) {
            sortSelect.addEventListener('change', (e) => {
                this.state.sort = e.target.value;
                this.loadTopics();
            });
        }

        // New topic form
        const newTopicForm = document.getElementById('newTopicForm');
        if (newTopicForm) {
            newTopicForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const title = document.getElementById('topicTitle')?.value?.trim();
                const content = document.getElementById('topicContent')?.value?.trim();
                const categoryId = document.getElementById('topicCategory')?.value;
                const tags = (document.getElementById('topicTags')?.value || '')
                    .split(',')
                    .map(t => t.trim())
                    .filter(Boolean);

                if (!title || !content || !categoryId) {
                    this.showMessage('Please fill in title, category, and content.', 'error');
                    return;
                }

                const ok = await this.createTopic({ title, content, categoryId, tags });
                if (ok) {
                    this.closeModal('newTopicModal');
                }
            });
        }

        // Editor buttons
        document.querySelectorAll('.editor-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const format = e.currentTarget.dataset.format;
                this.formatText(format);
            });
        });

        // Close-modal buttons
        document.querySelectorAll('.close-modal').forEach(btn => {
            btn.addEventListener('click', () => this.closeModal('newTopicModal'));
        });

        // Click outside modal to close
        window.addEventListener('click', (e) => {
            if (e.target.classList?.contains('modal')) {
                e.target.style.display = 'none';
            }
        });
    },

    // ============================================================
    // LOADERS
    // ============================================================

    async loadStats() {
        const res = await fetch("https://fissk-iui2.onrender.com/forum-api/stats", { headers: this.headers() });
        if (!res.ok) throw new Error(`Stats request failed: ${res.status}`);
        const stats = await res.json();

        const set = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.textContent = val ?? 0;
        };
        set('totalTopics', stats.totalTopics);
        set('totalUsers', stats.totalUsers);
        set('totalReplies', stats.totalReplies);
        set('solvedTopics', stats.solvedTopics);
    },

    async loadCategories() {
        const res = await fetch("https://fissk-iui2.onrender.com/forum-api/categories", { headers: this.headers() });
        if (!res.ok) throw new Error(`Categories request failed: ${res.status}`);
        const cats = await res.json();
        if (!Array.isArray(cats)) throw new Error('Categories response was not an array');

        const categoriesList = document.getElementById('categoriesList');
        if (categoriesList) {
            if (cats.length === 0) {
                categoriesList.innerHTML = `<div class="no-content"><p>No forum categories available yet.</p></div>`;
            } else {
                categoriesList.innerHTML = cats.map(c => `
                    <div class="category-card" onclick="forumUI.setCategory('${c.slug}')">
                        <div class="category-icon">${c.icon || '📌'}</div>
                        <div class="category-info">
                            <h4>${c.name}</h4>
                            <p>${c.description || ''}</p>
                        </div>
                    </div>
                `).join("");
            }
        }

        const topicCategory = document.getElementById('topicCategory');
        if (topicCategory) {
            topicCategory.innerHTML =
                `<option value="">Select category</option>` +
                cats.map(c => `<option value="${c._id}">${c.icon || '📌'} ${c.name}</option>`).join("");
        }
    },

    async loadCategoriesForSelect() {
        try {
            const res = await fetch('https://fissk-iui2.onrender.com/forum-api/categories', { headers: this.headers() });
            if (!res.ok) return;
            const cats = await res.json();
            const select = document.getElementById('topicCategory');
            if (select && Array.isArray(cats)) {
                select.innerHTML = cats.map(c => `
                    <option value="${c._id}">${c.icon || '📌'} ${c.name}</option>
                `).join('');
            }
        } catch (err) {
            console.error('Load categories for select error:', err);
        }
    },

    setCategory(slug) {
        this.state.category = slug || "";
        this.loadTopics();
    },

    async loadTopics() {
        const { search, sort, category } = this.state;
        const params = new URLSearchParams({
            search: search || "",
            sort: sort || "recent",
            category: category || ""
        });

        const res = await fetch(
            `https://fissk-iui2.onrender.com/forum-api/topics?${params.toString()}`,
            { headers: this.headers() }
        );
        if (!res.ok) throw new Error(`Topics request failed: ${res.status}`);
        const topics = await res.json();
        if (!Array.isArray(topics)) throw new Error('Topics response was not an array');

        const topicsList = document.getElementById('topicsList');
        if (!topicsList) return;

        if (topics.length === 0) {
            topicsList.innerHTML = `
                <div class="no-content">
                    <p>No topics found. Be the first to start a discussion!</p>
                    <button class="btn btn-primary" onclick="forumUI.openNewTopicModal()">
                        Start a Discussion
                    </button>
                </div>
            `;
            return;
        }

        topicsList.innerHTML = topics.map(t => {
            const replyCount = t.replyCount ?? t.reply_count ?? (Array.isArray(t.replies) ? t.replies.length : 0);
            const views = t.views || 0;
            const title = t.title || 'Untitled';
            const categoryName = t.category_name || (t.categoryId?.name) || 'General';
            return `
                <div class="topic-item">
                    <div class="topic-left">
                        <h3>
                            ${t.isPinned || t.is_pinned ? "📌 " : ""}
                            ${t.solved ? "✅ " : ""}
                            ${this.escapeHtml(title)}
                        </h3>
                        <div class="topic-meta">
                            <span>${this.escapeHtml(categoryName)}</span>
                            <span>💬 ${replyCount}</span>
                            <span>👀 ${views}</span>
                        </div>
                    </div>
                    <a href="forum-post.html?id=${t._id}" class="btn btn-outline">View</a>
                </div>
            `;
        }).join("");
    },

    async loadActivity() {
        if (!userId) {
            const recentActivity = document.getElementById('recentActivity');
            if (recentActivity) {
                recentActivity.innerHTML = `<p style="color:#6B7280; font-size:0.9rem;">Log in to see your activity.</p>`;
            }
            return;
        }

        const res = await fetch(
            `https://fissk-iui2.onrender.com/forum-api/activity/${userId}`,
            { headers: this.headers() }
        );
        if (!res.ok) throw new Error(`Activity request failed: ${res.status}`);
        const data = await res.json();

        const topicCount = Array.isArray(data.topics) ? data.topics.length : 0;
        const replyCount = Array.isArray(data.replies) ? data.replies.length : 0;

        const recentActivity = document.getElementById('recentActivity');
        if (recentActivity) {
            recentActivity.innerHTML = `
                <div class="activity-item">
                    <strong>Your Topics</strong>
                    <span>${topicCount}</span>
                </div>
                <div class="activity-item">
                    <strong>Your Replies</strong>
                    <span>${replyCount}</span>
                </div>
            `;
        }
    },

    // ============================================================
    // MODALS
    // ============================================================

    async openNewTopicModal() {
        if (!userId) {
            this.showMessage('Please log in to start a discussion.', 'error');
            return;
        }
        await this.loadCategoriesForSelect();
        const modal = document.getElementById('newTopicModal');
        if (modal) modal.style.display = 'flex';
    },

    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) modal.style.display = 'none';
    },

    toggleModal(id, show) {
        const modal = document.getElementById(id);
        if (modal) modal.style.display = show ? "flex" : "none";
    },

    // ============================================================
    // CREATE TOPIC
    // ============================================================

    async createTopic(payload) {
        if (!userId) {
            this.showMessage('Please log in to post.', 'error');
            return false;
        }

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

            this.showMessage('Successfully created discussion', 'success');
            await Promise.allSettled([
                this.loadTopics(),
                this.loadStats(),
                this.loadActivity()
            ]);
            return true;
        } catch (err) {
            console.error('createTopic error:', err);
            this.showMessage('Network error while creating topic.', 'error');
            return false;
        }
    },

    // ============================================================
    // UTILITIES
    // ============================================================

    formatText(format) {
        const textarea = document.getElementById('topicContent');
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const selectedText = textarea.value.substring(start, end);

        let formattedText = '';
        switch (format) {
            case 'bold':   formattedText = `**${selectedText}**`; break;
            case 'italic': formattedText = `*${selectedText}*`; break;
            case 'code':   formattedText = `\`${selectedText}\``; break;
            case 'link':   formattedText = `[${selectedText}](url)`; break;
            default: return;
        }

        textarea.value =
            textarea.value.substring(0, start) +
            formattedText +
            textarea.value.substring(end);

        textarea.focus();
        const newCursor = start + formattedText.length;
        textarea.setSelectionRange(newCursor, newCursor);
    },

    showMessage(message, type = 'success') {
        const el = document.createElement('div');
        el.className = `forum-message forum-message-${type}`;
        el.textContent = message;
        el.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            border-radius: 10px;
            color: white;
            background: ${type === 'success' ? '#48BB78' : '#F56565'};
            z-index: 10000;
            box-shadow: 0 5px 15px rgba(0,0,0,0.2);
            max-width: 400px;
        `;
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 3000);
    },

    truncateText(text, maxLength) {
        if (!text) return '';
        return text.length <= maxLength ? text : text.substring(0, maxLength) + '...';
    },

    escapeHtml(s) {
        if (s == null) return '';
        return String(s).replace(/[&<>"']/g, ch => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[ch]));
    }
};

// ===== BOOT =====
document.addEventListener("DOMContentLoaded", () => forumUI.init());

// ===== MOBILE NAVIGATION =====
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