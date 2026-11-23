// ============================================================
// forum-post.js — Single Topic View
// Fixed: CORS preflight (removed userId header), error states,
//        reply actions, "best answer" for class topics.
// ============================================================

const user = JSON.parse(localStorage.getItem("user"));
const userId = user?.id || null;

const urlParams = new URLSearchParams(window.location.search);
const topicId = urlParams.get('topicId') || urlParams.get('id');
const classId = urlParams.get('classId');

const topicCard = document.getElementById('topicCard');
const repliesList = document.getElementById('repliesList');
const replyForm = document.getElementById('replyForm');
const backLink = document.getElementById('backToForum');

// ===== HEADERS (no userId header — that triggered CORS) =====
function apiHeaders(json = false) {
    const h = {};
    const token = localStorage.getItem('token');
    if (token) h['Authorization'] = `Bearer ${token}`;
    if (json) h['Content-Type'] = 'application/json';
    return h;
}

// ===== HELPERS =====
function escapeHtml(s) {
    if (s == null) return '';
    return String(s).replace(/[&<>"']/g, ch => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[ch]));
}

function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleDateString('en-US', {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
}

function showMessage(message, type = 'error') {
    const el = document.createElement('div');
    el.className = `forum-message forum-message-${type}`;
    el.textContent = message;
    el.style.cssText = `
        position:fixed;top:20px;right:20px;padding:15px 20px;border-radius:10px;
        color:white;background:${type === 'success' ? '#48BB78' : '#F56565'};
        z-index:10000;box-shadow:0 5px 15px rgba(0,0,0,0.2);max-width:400px;`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3000);
}

async function logout() {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    window.location.href = '/';
}

// ===== USER DROPDOWN =====
if (user) {
    const dropdown = document.getElementById('user-dropdown');
    if (dropdown) {
        dropdown.innerHTML = `
            <img src="https://ui-avatars.com/api/?name=${user.firstName || user.firstname || 'U'}+${user.lastName || user.lastname || ''}&background=8B5FBF&color=fff" alt="User" class="user-avatar" id="user-avatar">
            <span id="instructorName">${user.firstName || user.firstname || 'User'}</span>
            <div class="dropdown-content">
                <a href="profile.html">Profile</a>
                <a href="settings.html">Settings</a>
                <a href="#" class="logout" onclick="logout()">Logout</a>
            </div>
        `;
    }
}

// ===== RENDER HELPERS =====

function renderLoading() {
    if (topicCard) {
        topicCard.innerHTML = `
            <div style="text-align:center;padding:40px;color:#6B7280;">
                <div style="display:inline-block;width:32px;height:32px;border:3px solid #e5e7eb;border-top-color:#8B5FBF;border-radius:50%;animation:spin 0.8s linear infinite;margin-bottom:12px;"></div>
                <p>Loading topic...</p>
            </div>
            <style>@keyframes spin{to{transform:rotate(360deg)}}</style>
        `;
    }
}

function renderError(message, retry = true) {
    if (topicCard) {
        topicCard.innerHTML = `
            <div class="error" style="background:#fee2e2;padding:20px;border-radius:8px;color:#991b1b;">
                <p><strong>❌ ${escapeHtml(message)}</strong></p>
                <p style="font-size:0.9rem;margin-top:8px;">The topic could not be loaded. This may be a temporary network issue.</p>
                <div style="margin-top:16px;display:flex;gap:8px;">
                    ${retry ? `<button class="btn btn-primary" onclick="loadTopic()">Retry</button>` : ''}
                    <a href="${classId ? `class.html?id=${classId}` : 'forum.html'}" class="btn btn-outline">Back to Forum</a>
                </div>
            </div>
        `;
    }
}

function displayTopic(topic) {
    if (!topic) return;

    const isAuthor = userId && (
        topic.userId?._id === userId ||
        topic.userId === userId
    );

    let authorName = topic.author_name || 'Anonymous';
    if (!topic.author_name && topic.userId?.firstName) {
        authorName = `${topic.userId.firstName} ${topic.userId.lastName || ''}`.trim();
    }

    const authorAvatar = topic.author?.profile_picture ||
        topic.userId?.profilePicture ||
        `https://ui-avatars.com/api/?name=${encodeURIComponent(authorName)}&background=8B5FBF&color=fff`;

    const categoryName = topic.category_name || topic.categoryId?.name || 'General';
    const replyCount = topic.replyCount ?? (Array.isArray(topic.replies) ? topic.replies.length : 0);

    topicCard.innerHTML = `
        <div class="topic-header">
            <h2>${escapeHtml(topic.title)}</h2>
            <div class="topic-meta">
                <span class="topic-category">📌 ${escapeHtml(categoryName)}</span>
                ${topic.solved ? '<span class="badge-solved">✅ Solved</span>' : ''}
                ${topic.isPinned ? '<span class="badge-pinned">📌 Pinned</span>' : ''}
            </div>
        </div>
        <div class="topic-content">
            <div class="topic-author">
                <img src="${authorAvatar}" alt="${escapeHtml(authorName)}" class="author-avatar">
                <div class="author-info">
                    <strong>${escapeHtml(authorName)}</strong>
                    <small>${formatDate(topic.createdAt || topic.created_at)}</small>
                </div>
            </div>
            <div class="topic-body">
                <p>${escapeHtml(topic.content).replace(/\n/g, '<br>')}</p>
            </div>
            <div class="topic-stats">
                <span>👀 ${topic.views || 0} views</span>
                <span>💬 ${replyCount} replies</span>
            </div>
            <div class="topic-actions">
                <a href="${classId ? `class.html?id=${classId}` : 'forum.html'}" class="btn btn-outline">← Back to Forum</a>
                ${isAuthor ? `<button onclick="deleteTopic()" class="btn btn-danger">Delete Topic</button>` : ''}
            </div>
        </div>
    `;
}

function displayReplies(replies) {
    if (!repliesList) return;

    if (!Array.isArray(replies) || replies.length === 0) {
        repliesList.innerHTML = '<div class="no-replies">No replies yet. Be the first to reply!</div>';
        return;
    }

    repliesList.innerHTML = replies.map((reply, index) => {
        const isAuthor = userId && (
            reply.userId?._id === userId || reply.userId === userId
        );

        let replyAuthorName = reply.author_name || 'Anonymous';
        if (!reply.author_name && reply.userId?.firstName) {
            replyAuthorName = `${reply.userId.firstName} ${reply.userId.lastName || ''}`.trim();
        }

        const replyAvatar = reply.userId?.profilePicture ||
            `https://ui-avatars.com/api/?name=${encodeURIComponent(replyAuthorName)}&background=8B5FBF&color=fff`;

        const isBestAnswer = reply.isBestAnswer;

        return `
            <div class="reply-card ${isBestAnswer ? 'best-answer' : ''}" data-reply-index="${index}">
                ${isBestAnswer ? '<div class="best-answer-badge">✅ Best Answer</div>' : ''}
                <div class="reply-author">
                    <img src="${replyAvatar}" alt="${escapeHtml(replyAuthorName)}" class="author-avatar">
                    <div class="author-info">
                        <strong>${escapeHtml(replyAuthorName)}</strong>
                        <small>${formatDate(reply.createdAt)}</small>
                    </div>
                </div>
                <div class="reply-content">
                    <p>${escapeHtml(reply.content).replace(/\n/g, '<br>')}</p>
                </div>
                <div class="reply-actions">
                    <button onclick="likeReply(${index})" class="btn-like">❤️ ${reply.likes || 0} likes</button>
                    ${!isBestAnswer && userId && !isAuthor ? `
                        <button onclick="markAsBestAnswer(${index})" class="btn-best">⭐ Mark as Best Answer</button>
                    ` : ''}
                    ${isAuthor ? `
                        <button onclick="deleteReply(${index})" class="btn-delete">🗑️ Delete</button>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');
}

// ===== LOAD TOPIC =====

async function loadTopic() {
    if (!topicId) {
        renderError('No topic specified', false);
        return;
    }

    renderLoading();

    try {
        const url = classId
            ? `https://fissk-iui2.onrender.com/forum-api/class/${classId}/topics/${topicId}`
            : `https://fissk-iui2.onrender.com/forum-api/topics/${topicId}`;

        const response = await fetch(url, { headers: apiHeaders() });

        if (response.status === 404) {
            renderError('Topic not found', false);
            return;
        }
        if (!response.ok) {
            throw new Error(`Server returned ${response.status}`);
        }

        const data = await response.json();
        const topic = data.topic || data;

        displayTopic(topic);

        // Replies may be embedded in the topic, or need a separate fetch
        if (Array.isArray(topic.replies) && topic.replies.length > 0) {
            displayReplies(topic.replies);
        } else if (Array.isArray(data.replies) && data.replies.length > 0) {
            displayReplies(data.replies);
        } else {
            await loadReplies();
        }

        if (backLink) {
            backLink.href = classId ? `class.html?id=${classId}` : 'forum.html';
        }
    } catch (error) {
        console.error('Error loading topic:', error);
        renderError(error.message || 'Failed to load topic');
    }
}

async function loadReplies() {
    try {
        const url = classId
            ? `https://fissk-iui2.onrender.com/forum-api/class/${classId}/topics/${topicId}/replies`
            : `https://fissk-iui2.onrender.com/forum-api/topics/${topicId}/replies`;

        const response = await fetch(url, { headers: apiHeaders() });

        if (!response.ok) {
            if (repliesList) repliesList.innerHTML = '<div class="no-replies">Failed to load replies.</div>';
            return;
        }

        const replies = await response.json();
        displayReplies(replies);
    } catch (error) {
        console.error('Error loading replies:', error);
        if (repliesList) repliesList.innerHTML = '<div class="no-replies">Error loading replies.</div>';
    }
}

// ===== ACTIONS =====

async function addReply(content) {
    if (!userId) { showMessage('Please log in to reply.', 'error'); return; }

    try {
        const url = classId
            ? `https://fissk-iui2.onrender.com/forum-api/class/${classId}/topics/${topicId}/replies`
            : `https://fissk-iui2.onrender.com/forum-api/topics/${topicId}/replies`;

        const response = await fetch(url, {
            method: 'POST',
            headers: apiHeaders(true),
            body: JSON.stringify({ content, userId })
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(data.message || 'Failed to post reply');
        }

        await loadTopic();
        if (replyForm) replyForm.reset();
        showMessage('Reply posted!', 'success');
    } catch (error) {
        console.error('Error posting reply:', error);
        showMessage(error.message || 'Failed to post reply', 'error');
    }
}

async function likeReply(replyIndex) {
    if (!userId) { showMessage('Please log in to like replies.', 'error'); return; }

    try {
        const url = `https://fissk-iui2.onrender.com/forum-api/replies/${topicId}/${replyIndex}/like`;
        const response = await fetch(url, {
            method: 'POST',
            headers: apiHeaders(true),
            body: JSON.stringify({ userId })
        });

        if (!response.ok) throw new Error('Failed to like reply');
        await loadTopic();
        showMessage('Reply liked!', 'success');
    } catch (error) {
        console.error('Error liking reply:', error);
        showMessage(error.message, 'error');
    }
}

async function markAsBestAnswer(replyIndex) {
    if (!userId) { showMessage('Please log in to mark best answer.', 'error'); return; }

    try {
        const url = `https://fissk-iui2.onrender.com/forum-api/replies/${topicId}/${replyIndex}/best`;
        const response = await fetch(url, {
            method: 'POST',
            headers: apiHeaders(true),
            body: JSON.stringify({ userId })
        });

        if (!response.ok) throw new Error('Failed to mark best answer');
        await loadTopic();
        showMessage('Marked as best answer!', 'success');
    } catch (error) {
        console.error('Error marking best answer:', error);
        showMessage(error.message, 'error');
    }
}

async function deleteReply(replyIndex) {
    if (!confirm('Delete this reply?')) return;

    try {
        const url = `https://fissk-iui2.onrender.com/forum-api/delete-reply/${topicId}/${replyIndex}`;
        const response = await fetch(url, {
            method: 'DELETE',
            headers: apiHeaders(true)
        });

        if (!response.ok) throw new Error('Failed to delete reply');
        await loadTopic();
        showMessage('Reply deleted!', 'success');
    } catch (error) {
        console.error('Error deleting reply:', error);
        showMessage(error.message, 'error');
    }
}

async function deleteTopic() {
    if (!confirm('Delete this topic? This cannot be undone.')) return;

    try {
        const url = classId
            ? `https://fissk-iui2.onrender.com/forum-api/class/${classId}/topics/${topicId}`
            : `https://fissk-iui2.onrender.com/forum-api/delete-post/${topicId}`;

        const response = await fetch(url, {
            method: 'DELETE',
            headers: apiHeaders(true),
            body: JSON.stringify({ userId })
        });

        if (!response.ok) throw new Error('Failed to delete topic');
        showMessage('Topic deleted!', 'success');
        setTimeout(() => {
            window.location.href = classId ? `class.html?id=${classId}` : 'forum.html';
        }, 1000);
    } catch (error) {
        console.error('Error deleting topic:', error);
        showMessage(error.message, 'error');
    }
}

// ===== INIT =====

if (replyForm) {
    replyForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!userId) { showMessage('Please log in to reply.', 'error'); return; }
        const content = replyForm.content.value.trim();
        if (!content) { showMessage('Please enter a reply.', 'error'); return; }
        await addReply(content);
    });
}

if (topicId) {
    loadTopic();
} else {
    renderError('No topic specified', false);
}

// ===== MOBILE NAV =====
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