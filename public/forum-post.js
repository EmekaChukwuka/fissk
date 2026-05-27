// forum-post.js
const user = JSON.parse(localStorage.getItem("user"));
const userId = user?.id;

// Get topic ID from URL
const urlParams = new URLSearchParams(window.location.search);
const topicId = urlParams.get('id');

// DOM Elements
const topicCard = document.getElementById('topicCard');
const repliesList = document.getElementById('repliesList');
const replyForm = document.getElementById('replyForm');

// Helper functions
function escapeHtml(s) {
    if (!s) return '';
    return String(s).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"})[ch]);
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Load user dropdown
if (user) {
    document.getElementById('user-dropdown').innerHTML = `
        <img src="https://ui-avatars.com/api/?name=${user.firstname}+${user.lastname}&background=8B5FBF&color=fff" alt="User" class="user-avatar" id="user-avatar">
        <span id="instructorName">${user.firstname}</span>
        <div class="dropdown-content">
            <a href="profile.html">Profile</a>
            <a href="settings.html">Settings</a>
            <a href="#" class="logout" onclick="logout()">Logout</a>
        </div>
    `;
}

async function logout() {
    localStorage.removeItem('user');
    window.location.href = "/";
}

// Load topic details
async function loadTopic() {
    if (!topicId) {
        topicCard.innerHTML = '<div class="error">No topic ID specified</div>';
        return;
    }

    try {
        const response = await fetch(`https://fissk-backend.onrender.com/forum-api/topics/${topicId}`, {
            headers: {
                'Content-Type': 'application/json',
                'userId': userId
            }
        });

        if (!response.ok) {
            throw new Error('Failed to load topic');
        }

        const data = await response.json();
        const topic = data.topic || data;
        
        displayTopic(topic);
        
        // Load replies
        if (topic.replies && topic.replies.length > 0) {
            displayReplies(topic.replies);
        } else {
            loadReplies();
        }
    } catch (error) {
        console.error('Error loading topic:', error);
        topicCard.innerHTML = `<div class="error">Error loading topic: ${error.message}</div>`;
    }
}

// Display topic
function displayTopic(topic) {
    const isAuthor = userId && topic.userId && topic.userId._id === userId;
    const authorName = topic.author?.first_name && topic.author?.last_name 
        ? `${topic.author.first_name} ${topic.author.last_name}`
        : topic.userId?.firstName && topic.userId?.lastName
        ? `${topic.userId.firstName} ${topic.userId.lastName}`
        : topic.author_name || 'Anonymous';
    
    const authorAvatar = topic.author?.profile_picture || 
                        topic.userId?.profilePicture || 
                        `https://ui-avatars.com/api/?name=${encodeURIComponent(authorName)}&background=8B5FBF&color=fff`;
    
    topicCard.innerHTML = `
        <div class="topic-header">
            <h2>${escapeHtml(topic.title)}</h2>
            <div class="topic-meta">
                <span class="topic-category">📌 ${escapeHtml(topic.category_name || topic.categoryId?.name || 'General')}</span>
                ${topic.solved ? '<span class="badge-solved">✅ Solved</span>' : ''}
                ${topic.isPinned ? '<span class="badge-pinned">📌 Pinned</span>' : ''}
            </div>
        </div>
        <div class="topic-content">
            <div class="topic-author">
                <img src="${authorAvatar}" alt="${authorName}" class="author-avatar">
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
                <span>💬 ${topic.replies?.length || 0} replies</span>
            </div>
            ${isAuthor ? `
                <div class="topic-actions">
                    <button onclick="deleteTopic()" class="btn btn-danger">Delete Topic</button>
                </div>
            ` : ''}
        </div>
    `;
}

// Load replies separately if not included in topic
async function loadReplies() {
    try {
        const response = await fetch(`https://fissk-backend.onrender.com/forum-api/topics/${topicId}/replies`, {
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            const replies = await response.json();
            displayReplies(replies);
        }
    } catch (error) {
        console.error('Error loading replies:', error);
        repliesList.innerHTML = '<div class="error">Error loading replies</div>';
    }
}

// Display replies
function displayReplies(replies) {
    if (!replies || replies.length === 0) {
        repliesList.innerHTML = '<div class="no-replies">No replies yet. Be the first to reply!</div>';
        return;
    }

    repliesList.innerHTML = replies.map((reply, index) => {
        const isAuthor = userId && reply.userId && reply.userId._id === userId;
        const replyAuthorName = reply.author_name || 
            (reply.userId?.firstName && reply.userId?.lastName 
                ? `${reply.userId.firstName} ${reply.userId.lastName}`
                : 'Anonymous');
        
        const replyAuthorAvatar = reply.userId?.profilePicture || 
            `https://ui-avatars.com/api/?name=${encodeURIComponent(replyAuthorName)}&background=8B5FBF&color=fff`;
        
        const isBestAnswer = reply.isBestAnswer;
        
        return `
            <div class="reply-card ${isBestAnswer ? 'best-answer' : ''}" data-reply-index="${index}">
                ${isBestAnswer ? '<div class="best-answer-badge">✅ Best Answer</div>' : ''}
                <div class="reply-author">
                    <img src="${replyAuthorAvatar}" alt="${replyAuthorName}" class="author-avatar">
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

// Add reply
async function addReply(content) {
    try {
        const response = await fetch(`https://fissk-backend.onrender.com/forum-api/topics/${topicId}/replies`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                content: content,
                userId: userId
            })
        });

        if (response.ok) {
            // Reload topic and replies
            await loadTopic();
            replyForm.reset();
            showMessage('Reply posted successfully!', 'success');
        } else {
            const error = await response.json();
            throw new Error(error.message || 'Failed to post reply');
        }
    } catch (error) {
        console.error('Error posting reply:', error);
        showMessage(error.message, 'error');
    }
}

// Like a reply
async function likeReply(replyIndex) {
    if (!userId) {
        showMessage('Please login to like replies', 'error');
        return;
    }

    try {
        const response = await fetch(`https://fissk-backend.onrender.com/forum-api/replies/${topicId}/${replyIndex}/like`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ userId })
        });

        if (response.ok) {
            await loadTopic();
            showMessage('Reply liked!', 'success');
        } else {
            throw new Error('Failed to like reply');
        }
    } catch (error) {
        console.error('Error liking reply:', error);
        showMessage(error.message, 'error');
    }
}

// Mark as best answer
async function markAsBestAnswer(replyIndex) {
    if (!userId) {
        showMessage('Please login to mark best answer', 'error');
        return;
    }

    try {
        const response = await fetch(`https://fissk-backend.onrender.com/forum-api/replies/${topicId}/${replyIndex}/best`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ userId })
        });

        if (response.ok) {
            await loadTopic();
            showMessage('Marked as best answer!', 'success');
        } else {
            throw new Error('Failed to mark best answer');
        }
    } catch (error) {
        console.error('Error marking best answer:', error);
        showMessage(error.message, 'error');
    }
}

// Delete reply
async function deleteReply(replyIndex) {
    if (!confirm('Are you sure you want to delete this reply?')) return;

    try {
        const response = await fetch(`https://fissk-backend.onrender.com/forum-api/delete-reply/${topicId}/${replyIndex}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            await loadTopic();
            showMessage('Reply deleted successfully!', 'success');
        } else {
            throw new Error('Failed to delete reply');
        }
    } catch (error) {
        console.error('Error deleting reply:', error);
        showMessage(error.message, 'error');
    }
}

// Delete topic
async function deleteTopic() {
    if (!confirm('Are you sure you want to delete this topic? This action cannot be undone.')) return;

    try {
        const response = await fetch(`https://fissk-backend.onrender.com/forum-api/delete-post/${topicId}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            showMessage('Topic deleted successfully!', 'success');
            setTimeout(() => {
                window.location.href = 'forum.html';
            }, 1500);
        } else {
            throw new Error('Failed to delete topic');
        }
    } catch (error) {
        console.error('Error deleting topic:', error);
        showMessage(error.message, 'error');
    }
}

// Show message
function showMessage(message, type) {
    const messageEl = document.createElement('div');
    messageEl.className = `forum-message forum-message-${type}`;
    messageEl.textContent = message;
    messageEl.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        border-radius: 10px;
        color: white;
        background: ${type === 'success' ? '#48BB78' : '#F56565'};
        z-index: 10000;
        box-shadow: 0 5px 15px rgba(0,0,0,0.2);
    `;

    document.body.appendChild(messageEl);

    setTimeout(() => {
        messageEl.remove();
    }, 3000);
}

// Handle reply form submission
if (replyForm) {
    replyForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        if (!userId) {
            showMessage('Please login to post a reply', 'error');
            return;
        }
        
        const content = replyForm.content.value.trim();
        if (!content) {
            showMessage('Please enter a reply', 'error');
            return;
        }
        
        await addReply(content);
    });
}

// Mobile Navigation
const hamburger = document.querySelector('.hamburger');
const navMenu = document.querySelector('.nav-menu');

if (hamburger) {
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
        hamburger.classList.remove('active');
        navMenu.classList.remove('active');
        navMenu.style.display = 'none';
        document.body.style.overflow = 'auto';
    });
});

// Initialize
if (topicId) {
    loadTopic();
} else {
    topicCard.innerHTML = '<div class="error">No topic specified</div>';
}