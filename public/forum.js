const user = JSON.parse(localStorage.getItem("user"));
const userId = user.id;

if(user){
     document.getElementById('user-dropdown').innerHTML = `
                        <img src="https://ui-avatars.com/api/?name=${user.firstname}+${user.lastname}&background=8B5FBF&color=fff" alt="User" class="user-avatar" id="user-avatar">
                        <span id="instructorName">${user.firstname}</span>
                        <div class="dropdown-content">
                            <a href="profile.html">Profile</a>
                            <a href="settings.html">Settings</a>
                            <a href="#" class="logout" onclick="logout()">Logout</a>
                        </div>`;
}


        async function logout() {
            localStorage.removeItem('user');
            window.location.href = "/";
        }

const forumUI = {
  state: {
    category: "",
    search: "",
    sort: "recent"
  },

  headers(json = false) {
    const h = { userId: userId };
    if (json) h["Content-Type"] = "application/json";
    return h;
  },

  async init() {
    await this.loadStats();
    await this.loadCategories();
    await this.loadTopics();
    await this.loadActivity();
    this.setupEventListeners();
    this.bindEvents();
  },

  bindEvents() {
    document.getElementById("forumSearch").addEventListener("input", e => {
      this.state.search = e.target.value;
      this.loadTopics();
    });

    document.getElementById("sortTopics").addEventListener("change", e => {
      this.state.sort = e.target.value;
      this.loadTopics();
    });

    
    document.querySelectorAll(".close-modal").forEach(btn =>
      btn.addEventListener("click", () =>
        this.closeModal("newTopicModal", false)
      )
    );
      // New topic form
        const newTopicForm = document.getElementById('newTopicForm');
        if (newTopicForm) {
            newTopicForm.addEventListener('submit', (e) => {
                e.preventDefault();
                
                const title = document.getElementById('topicTitle').value;
                const content = document.getElementById('topicContent').value;
                const categoryId = document.getElementById('topicCategory').value;
                const tags = document.getElementById('topicTags').value
                    .split(',')
                    .map(tag => tag.trim())
                    .filter(tag => tag.length > 0);

                this.createTopic({
                    title,
                    content,
                    categoryId,
                    tags
                });
            });
        }

        // Editor tools
        document.querySelectorAll('.editor-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const format = e.target.dataset.format;
                this.formatText(format);
            });
        });
  },

  async loadStats() {
    const res = await fetch("https://fissk-backend.onrender.com/forum-api/stats", { headers: this.headers() });
    const stats = await res.json();

    totalTopics.textContent = stats.totalTopics;
    totalUsers.textContent = stats.totalUsers;
    totalReplies.textContent = stats.totalReplies;
    solvedTopics.textContent = stats.solvedTopics;
  },

  async loadCategories() {
    const res = await fetch("https://fissk-backend.onrender.com/forum-api/categories", { headers: this.headers() });
    const cats = await res.json();

    categoriesList.innerHTML = cats.map(c => `
      <div class="category-card" onclick="forumUI.setCategory('${c.slug}')">
        <div class="category-icon">${c.icon}</div>
        <div class="category-info">
          <h4>${c.name}</h4>
          <p>${c.description || ""}</p>
        </div>
      </div>
    `).join("");

topicCategory.innerHTML =
      `<option value="">Select category</option>` +
      cats.map(c => `<option value="${c._id}">${c.icon || '📌'} ${c.name}</option>`).join("");
  },

  setCategory(slug) {
    this.state.category = slug;
    this.loadTopics();
  },

  async loadTopics() {
    const { search, sort, category } = this.state;

    const res = await fetch(
      `https://fissk-backend.onrender.com/forum-api/topics?search=${search}&sort=${sort}&category=${category}`,
      { headers: this.headers() }
    );
    const topics = await res.json();

    if (!topics.length) {
      topicsList.innerHTML = `  <div class="no-content">
                    <p>No topics found. Be the first to start a discussion!</p>
                    <button class="btn btn-primary" onclick="forumUI.openNewTopicModal()">
                        Start a Discussion
                    </button>
                </div>`;
      return;
    }

    topicsList.innerHTML = topics.map(t => `
      <div class="topic-item">
        <div class="topic-left">
          <h3>
            ${t.is_pinned ? "📌" : ""}
            ${t.solved ? "✅" : ""}
            ${t.title}
          </h3>
          <div class="topic-meta">
            <span>${t.category_name}</span>
            <span>💬 ${t.reply_count}</span>
            <span>👀 ${t.views}</span>
          </div>
        </div>
        <a href="forum-post.html?id=${t._id}" class="btn btn-outline">View</a>
      </div>
    `).join("");
  },

  async loadActivity() {
    const res = await fetch(`https://fissk-backend.onrender.com/forum-api/activity/${userId}`, { headers: this.headers() });
    const data = await res.json();

    const topics =  `
      <div class="activity-item">
        <strong>Your Topics</strong>
        <span>${data.topics.length }</span>
   </div>
      </div>
    `;
    const replies =  `
      <div class="activity-item">
        <strong>Your Replies</strong>
        <span>${data.replies.length }</span>
      </div>
    `;
    recentActivity.innerHTML = topics + replies;

  },

    async openNewTopicModal() {
        this.loadCategoriesForSelect();
        document.getElementById('newTopicModal').style.display = 'flex';
    },

async loadCategoriesForSelect() {
    try {
        const response = await fetch('https://fissk-backend.onrender.com/forum-api/categories');
        if (response.ok) {
            const categories = await response.json();
            const select = document.getElementById('topicCategory');
            select.innerHTML = categories.map(category => `
                <option value="${category._id}">${category.icon || '📌'} ${category.name}</option>
            `).join('');
        }
    } catch (error) {
        console.error('Load categories for select error:', error);
    }
},

    
    formatText(format) {
        const textarea = document.getElementById('topicContent');
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const selectedText = textarea.value.substring(start, end);

        let formattedText = '';
        switch(format) {
            case 'bold':
                formattedText = `**${selectedText}**`;
                break;
            case 'italic':
                formattedText = `*${selectedText}*`;
                break;
            case 'code':
                formattedText = `\`${selectedText}\``;
                break;
            case 'link':
                formattedText = `[${selectedText}](url)`;
                break;
        }

        textarea.value = textarea.value.substring(0, start) + 
                        formattedText + 
                        textarea.value.substring(end);
        textarea.focus();
        textarea.setSelectionRange(start + formattedText.length, start + formattedText.length);
    },

    closeModal(modalId) {
        document.getElementById(modalId).style.display = 'none';
    },

    truncateText(text, maxLength) {
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    },

  

  async createTopic(e) {
    const title = e.title;
    const content = e.content;
    const categoryId = e.categoryId ;
    const res = await fetch("https://fissk-backend.onrender.com/forum-api/topics", {
      method: "POST",
       headers: {
                    'Content-Type': 'application/json'
                },
      body: JSON.stringify({title, content, categoryId, userId})
    });

    if (res.ok) {
      this.showMessage('Successfully created discussion', 'success');
      this.toggleModal("newTopicModal", false);
      this.loadTopics();
      this.loadStats();
      this.loadActivity();
    }
  },
  
    showMessage(message, type) {
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
    },

  toggleModal(id, show) {
    document.getElementById(id).style.display = show ? "flex" : "none";
  } ,
    setupEventListeners() {
        // New topic button
        const newTopicBtn = document.getElementById('newTopicBtn');
        if (newTopicBtn) {
            newTopicBtn.addEventListener('click', () => this.openNewTopicModal());
        }

        // Sort topics
        const sortSelect = document.getElementById('sortTopics');
        if (sortSelect) {
            sortSelect.addEventListener('change', (e) => {
                this.currentSort = e.target.value;
                this.loadTopics();
            });
        }

        // Search
        const searchInput = document.getElementById('forumSearch');
        const searchBtn = document.querySelector('.search-btn');
        
        if (searchInput && searchBtn) {
            const performSearch = () => {
                const query = searchInput.value.trim();
                if (query.length >= 3) {
                    this.searchTopics(query);
                }
            };

            searchBtn.addEventListener('click', performSearch);
            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') performSearch();
            });
        }


        // Editor tools
        document.querySelectorAll('.editor-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const format = e.target.dataset.format;
                this.formatText(format);
            });
        });
    },
};

document.addEventListener("DOMContentLoaded", () => forumUI.init());


// Handle modal close buttons
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const modal = e.target.closest('.modal');
            modal.style.display = 'none';
        });
    });

    // Close modal when clicking outside
    window.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            e.target.style.display = 'none';
        }
    });
});


// Mobile Navigation
const hamburger = document.querySelector('.hamburger');
const navMenu = document.querySelector('.nav-menu');


if (hamburger) {
    hamburger.addEventListener('click', () => {
        hamburger.classList.toggle('active');
        navMenu.classList.toggle('active');
        
        // Add mobile menu styles
        if (navMenu.classList.contains('active')) {
            navMenu.style.display = 'flex';
            document.body.style.overflow = 'hidden';
        } else {
            navMenu.style.display = 'none';
            document.body.style.overflow = 'auto';
        }
    });
}

// Close mobile menu when clicking on links
document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
        hamburger.classList.remove('active');
        navMenu.classList.remove('active');
        navMenu.style.display = 'none';
        document.body.style.overflow = 'auto';
    });
});



// Smooth scrolling for anchor links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }  
    });
});
