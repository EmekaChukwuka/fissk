// forum-post.js
const user = JSON.parse(localStorage.getItem("user"));
const userId = user?.id;

// Get topic ID from URL - support both 'id' and 'topicId' parameters
const urlParams = new URLSearchParams(window.location.search);
const topicId = urlParams.get('topicId') || urlParams.get('id');
const classId = urlParams.get('classId');

console.log('Topic ID:', topicId);
console.log('Class ID:', classId);

// DOM Elements
const topicCard = document.getElementById('topicCard');
const repliesList = document.getElementById('repliesList');
const replyForm = document.getElementById('replyForm');
const backLink = document.getElementById('backToForum');

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
    const userDropdown = document.getElementById('user-dropdown');
    if (userDropdown) {
        userDropdown.innerHTML = `
            <img src="https://ui-avatars.com/api/?name=${user.firstName || user.firstname}+${user.lastName || user.lastname}&background=8B5FBF&color=fff" alt="User" class="user-avatar" id="user-avatar">
            <span id="instructorName">${user.firstName || user.firstname}</span>
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
    window.location.href = "/";
}

// Load topic details - support both class and global forum topics
async function loadTopic() {
    if (!topicId) {
        topicCard.innerHTML = `
            <div class="error">
                <p>❌ No topic specified</p>
                <a href="${classId ? `class.html?id=${classId}` : 'forum.html'}" class="btn btn-outline">Back to Forum</a>
            </div>
        `;
        return;
    }

    try {
        // Try the class-specific endpoint first if we have a classId
        let url;
        if (classId) {
            url = `https://fissk-backend.onrender.com/forum-api/class/${classId}/topics/${topicId}`;
        } else {
            url = `https://fissk-backend.onrender.com/forum-api/topics/${topicId}`;
        }
        
        console.log('Fetching topic from:', url);
        
        const response = await fetch(url, {
            headers: {
                'Content-Type': 'application/json',
                'userId': userId || ''
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        console.log('Topic data:', data);
        
        // Handle different response formats
        const topic = data.topic || data;
        displayTopic(topic);
        
        // Load replies - check if replies are included or need separate fetch
        if (topic.replies && topic.replies.length > 0) {
            displayReplies(topic.replies);
        } else {
            loadReplies();
        }
        
        // Set back link
        if (backLink) {
            backLink.href = classId ? `class.html?id=${classId}` : 'forum.html';
        }
        
    } catch (error) {
        console.error('Error loading topic:', error);
        topicCard.innerHTML = `
            <div class="error">
                <p>❌ Error loading topic: ${error.message}</p>
                <a href="${classId ? `class.html?id=${classId}` : 'forum.html'}" class="btn btn-outline">Back to Forum</a>
            </div>
        `;
    }
}

// Display topic
function displayTopic(topic) {
    const isAuthor = userId && topic.userId && topic.userId._id === userId;
    const isAuthorById = userId && topic.userId === userId;
    
    // Get author name from various possible structures
    let authorName = 'Anonymous';
    if (topic.author_name) {
        authorName = topic.author_name;
    } else if (topic.author?.first_name && topic.author?.last_name) {
        authorName = `${topic.author.first_name} ${topic.author.last_name}`;
    } else if (topic.userId?.firstName && topic.userId?.lastName) {
        authorName = `${topic.userId.firstName} ${topic.userId.lastName}`;
    } else if (topic.userId?.firstname && topic.userId?.lastname) {
        authorName = `${topic.userId.firstname} ${topic.userId.lastname}`;
    } else if (typeof topic.userId === 'string' && topic.userId !== userId) {
        authorName = 'User';
    }
    
    const authorAvatar = topic.author?.profile_picture || 
                        topic.userId?.profilePicture || 
                        `https://ui-avatars.com/api/?name=${encodeURIComponent(authorName)}&background=8B5FBF&color=fff`;
    
    const categoryName = topic.category_name || topic.categoryId?.name || 'General';
    const replyCount = topic.replyCount || topic.replies?.length || 0;
    
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
                <span>💬 ${replyCount} replies</span>
            </div>
            <div class="topic-actions">
                <a href="${classId ? `class.html?id=${classId}` : 'forum.html'}" class="btn btn-outline">← Back to Forum</a>
                ${(isAuthor || isAuthorById) ? `
                    <button onclick="deleteTopic()" class="btn btn-danger">Delete Topic</button>
                ` : ''}
            </div>
        </div>
    `;
}

// Load replies separately if not included in topic
async function loadReplies() {
    try {
        let url;
        if (classId) {
            url = `https://fissk-backend.onrender.com/forum-api/class/${classId}/topics/${topicId}/replies`;
        } else {
            url = `https://fissk-backend.onrender.com/forum-api/topics/${topicId}/replies`;
        }
        
        const response = await fetch(url, {
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            const replies = await response.json();
            displayReplies(replies);
        } else {
            repliesList.innerHTML = '<div class="error">Failed to load replies</div>';
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
        const isAuthorById = userId && reply.userId === userId;
        
        let replyAuthorName = 'Anonymous';
        if (reply.author_name) {
            replyAuthorName = reply.author_name;
        } else if (reply.userId?.firstName && reply.userId?.lastName) {
            replyAuthorName = `${reply.userId.firstName} ${reply.userId.lastName}`;
        } else if (reply.userId?.firstname && reply.userId?.lastname) {
            replyAuthorName = `${reply.userId.firstname} ${reply.userId.lastname}`;
        }
        
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
                    ${!isBestAnswer && userId && !isAuthor && !isAuthorById ? `
                        <button onclick="markAsBestAnswer(${index})" class="btn-best">⭐ Mark as Best Answer</button>
                    ` : ''}
                    ${(isAuthor || isAuthorById) ? `
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
        let url;
        if (classId) {
            url = `https://fissk-backend.onrender.com/forum-api/class/${classId}/topics/${topicId}/replies`;
        } else {
            url = `https://fissk-backend.onrender.com/forum-api/topics/${topicId}/replies`;
        }
        
        const response = await fetch(url, {
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
        let url;
        if (classId) {
            url = `https://fissk-backend.onrender.com/forum-api/replies/${topicId}/${replyIndex}/like`;
        } else {
            url = `https://fissk-backend.onrender.com/forum-api/replies/${topicId}/${replyIndex}/like`;
        }
        
        const response = await fetch(url, {
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
        let url;
        if (classId) {
            url = `https://fissk-backend.onrender.com/forum-api/replies/${topicId}/${replyIndex}/best`;
        } else {
            url = `https://fissk-backend.onrender.com/forum-api/replies/${topicId}/${replyIndex}/best`;
        }
        
        const response = await fetch(url, {
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
        let url;
        if (classId) {
            url = `https://fissk-backend.onrender.com/forum-api/delete-reply/${topicId}/${replyIndex}`;
        } else {
            url = `https://fissk-backend.onrender.com/forum-api/delete-reply/${topicId}/${replyIndex}`;
        }
        
        const response = await fetch(url, {
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
        let url;
        if (classId) {
            url = `https://fissk-backend.onrender.com/forum-api/class/${classId}/topics/${topicId}`;
        } else {
            url = `https://fissk-backend.onrender.com/forum-api/delete-post/${topicId}`;
        }
        
        const response = await fetch(url, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ userId })
        });

        if (response.ok) {
            showMessage('Topic deleted successfully!', 'success');
            setTimeout(() => {
                window.location.href = classId ? `class.html?id=${classId}` : 'forum.html';
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
        max-width: 400px;
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
        document.body.style.overflow = 'auto';
    });
});

// Initialize
if (topicId) {
    loadTopic();
} else {
    topicCard.innerHTML = `
        <div class="error">
            <p>❌ No topic specified</p>
            <a href="${classId ? `class.html?id=${classId}` : 'forum.html'}" class="btn btn-outline">Back to Forum</a>
        </div>
    `;
}