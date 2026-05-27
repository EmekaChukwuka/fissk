// Classes Page Functionality
class ClassesManager {
    constructor() {
        this.classes = [];
        this.filteredClasses = [];
        this.currentFilter = 'all';
        this.searchQuery = '';
        this.user = null;
        this.init();
    }

    async init() {
        // Get logged in user
        this.user = JSON.parse(localStorage.getItem('user'));
        await this.loadClasses();
        this.setupEventListeners();
        this.renderClasses();
    }

    async loadClasses() {
        try {
            const response = await fetch('https://fissk-backend.onrender.com/register/classes');
            const data = await response.json();
            console.log('Classes loaded:', data);
            
            const coursesArray = data.classes;
            if (coursesArray && coursesArray.length !== 0) {
                // Check which classes user is enrolled in
                if (this.user && this.user.email) {
                    const enrolledResponse = await fetch('https://fissk-backend.onrender.com/register/get-user-classes', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email: this.user.email })
                    });
                    const enrolledData = await enrolledResponse.json();
                    const enrolledClassIds = new Set();
                    
                    if (enrolledData.classes && enrolledData.classes.length) {
                        enrolledData.classes.forEach(c => {
                            enrolledClassIds.add(c.class_id?.toString() || c._id?.toString());
                        });
                    }
                    
                    // Mark enrolled classes
                    this.classes = coursesArray.map(c => ({
                        ...c,
                        enrolled: enrolledClassIds.has(c._id?.toString())
                    }));
                } else {
                    this.classes = coursesArray;
                }
            } else {
                this.classes = [];
            }
            
            this.filteredClasses = [...this.classes];
            this.hideLoading();
            
            if (this.classes.length === 0) {
                this.showNoClassesMessage();
            }
        } catch (error) {
            console.error('Error loading classes:', error);
            this.classes = [];
            this.filteredClasses = [];
            this.hideLoading();
            this.showErrorMessage('Failed to load classes. Please refresh the page.');
        }
    }

    showNoClassesMessage() {
        const container = document.getElementById('classesContainer');
        if (container) {
            container.innerHTML = `
                <div class="no-content">
                    <p>No classes available at the moment. Please check back later.</p>
                </div>
            `;
        }
    }

    showErrorMessage(message) {
        const container = document.getElementById('classesContainer');
        if (container) {
            container.innerHTML = `
                <div class="error-content">
                    <p>⚠️ ${message}</p>
                    <button class="btn btn-primary" onclick="location.reload()">Retry</button>
                </div>
            `;
        }
    }

    setupEventListeners() {
        // Filter buttons
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.handleFilter(e.target.dataset.filter);
            });
        });

        // Search functionality
        const searchInput = document.getElementById('classSearch');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.handleSearch(e.target.value);
            });
        }

        // Enrollment modal
        this.setupModalEvents();
    }

    handleFilter(filter) {
        this.currentFilter = filter;
        
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.filter === filter);
        });

        this.applyFilters();
    }

    handleSearch(query) {
        this.searchQuery = query.toLowerCase();
        this.applyFilters();
    }

    applyFilters() {
        this.filteredClasses = this.classes.filter(classItem => {
            const matchesFilter = this.currentFilter === 'all' || 
                                classItem.category === this.currentFilter ||
                                classItem.level === this.currentFilter;
            
            const matchesSearch = !this.searchQuery || 
                                (classItem.title && classItem.title.toLowerCase().includes(this.searchQuery)) ||
                                (classItem.description && classItem.description.toLowerCase().includes(this.searchQuery));
            
            return matchesFilter && matchesSearch;
        });

        this.renderClasses();
    }

    renderClasses() {
        const container = document.getElementById('classesContainer');
        if (!container) return;

        if (this.filteredClasses.length === 0) {
            container.innerHTML = `
                <div class="no-content">
                    <p>No classes found matching your criteria.</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = this.filteredClasses.map(classItem => {
            const classId = classItem._id;
            const classTitle = classItem.title;
            const classDescription = classItem.description;
            const classLevel = classItem.level;
            const classDuration = classItem.duration;
            const maxStudents = classItem.maxStudents || 0;
            const enrolled = classItem.enrolled || false;
            
            return `
                <div class="class-card" data-class-id="${classId}">
                    <div class="class-card-image" style="background: linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%);"></div>
                    <div class="class-card-content">
                        <h3>${this.escapeHtml(classTitle)}</h3>
                        <p>${this.escapeHtml(classDescription)}</p>
                        <div class="class-meta">
                            <span>🟢 ${classLevel || 'Beginner'}</span>
                            <span>🕒 ${classDuration || 'Self-paced'}</span>
                            <span>👥 ${maxStudents} students</span>
                        </div>
                        <div class="class-actions">
                            ${enrolled ? 
                                `<button class="btn btn-outline" disabled>Already Enrolled</button>
                                 <a href="class.html?id=${classId}" class="btn btn-primary">Continue Learning</a>` :
                                `<button class="btn btn-primary enroll-btn" data-class-id="${classId}" data-class-name="${classTitle}" id="${classId}">Enroll Now</button>
                                 <a href="class.html?id=${classId}" class="btn btn-outline">View Details</a>`
                            }
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        // Add event listeners to enroll buttons
        document.querySelectorAll('.enroll-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const classId = e.target.id;
                this.showEnrollmentModal(classId);
            });
        });
    }

    async showEnrollmentModal(classId) {
        const classItem = this.classes.find(c => c._id == classId);
        if (!classItem) {
            console.error('Class not found:', classId);
            return;
        }

        const modal = document.getElementById('enrollmentModal');
        const modalContent = document.getElementById('modalClassDetails');
        
        try {
            // Get instructor info if available
            let instructorName = 'Staff';
            if (classItem.instructorId) {
                const response = await fetch('https://fissk-backend.onrender.com/register/classes/instructor', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ instructor_id: classItem.instructorId }),
                });
                const dataA = await response.json();
                if (dataA.instructorData) {
                    instructorName = `${dataA.instructorData.firstName || ''} ${dataA.instructorData.lastName || ''}`.trim() || 'Staff';
                }
            }
            
            modalContent.innerHTML = `
                <h3>${this.escapeHtml(classItem.title)}</h3>
                <p><strong>Category:</strong> ${classItem.category?.toUpperCase() || 'General'}</p>
                <p><strong>Level:</strong> ${classItem.level || 'Beginner'}</p>
                <p><strong>Duration:</strong> ${classItem.duration || 'Self-paced'}</p>
                <p><strong>Instructor:</strong> ${this.escapeHtml(instructorName)}</p>
                <p>${this.escapeHtml(classItem.description)}</p><br>
            `;

            modal.style.display = 'flex';

            const confirmBtn = document.getElementById('confirmEnroll');
            confirmBtn.onclick = () => this.enrollInClass(classId);
            const closeBtn = document.querySelector('.close-modal');
            const cancelBtn = document.getElementById('cancelEnroll');

            const hideModal = () => {
                modal.style.display = 'none';
            };

            closeBtn.addEventListener('click', hideModal);
            cancelBtn.addEventListener('click', hideModal);
            
            modal.addEventListener('click', (e) => {
                if (e.target === modal) hideModal();
            });
        } catch(err) {
            console.error('Error loading instructor:', err);
            modalContent.innerHTML = `
                <h3>${this.escapeHtml(classItem.title)}</h3>
                <p><strong>Category:</strong> ${classItem.category?.toUpperCase() || 'General'}</p>
                <p><strong>Level:</strong> ${classItem.level || 'Beginner'}</p>
                <p><strong>Duration:</strong> ${classItem.duration || 'Self-paced'}</p>
                <p><strong>Instructor:</strong> Staff</p>
                <p>${this.escapeHtml(classItem.description)}</p><br>
            `;
            modal.style.display = 'flex';
        }
    }

    async enrollInClass(classId) {
        if (!this.user || !this.user.email) {
            alert('Please login to enroll in classes');
            window.location.href = 'index.html';
            return;
        }

        try {
            const response = await fetch('https://fissk-backend.onrender.com/register/join-class', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ classId: classId, email: this.user.email })
            });

            if (response.ok) {
                // Update local state
                const classItem = this.classes.find(c => c._id == classId);
                if (classItem) {
                    classItem.enrolled = true;
                }
                
                this.hideModal();
                this.renderClasses();
                
                alert('Successfully enrolled in the class!');
                window.location.href = `class.html?id=${classId}`;
            } else {
                const error = await response.json();
                throw new Error(error.message || 'Enrollment failed');
            }
        } catch (error) {
            console.error('Error enrolling in class:', error);
            alert(error.message || 'Failed to enroll in class. Please try again.');
        }
    }

    setupModalEvents() {
        const modal = document.getElementById('enrollmentModal');
        if (!modal) return;
        
        const closeBtn = document.querySelector('.close-modal');
        const cancelBtn = document.getElementById('cancelEnroll');

        const hideModal = () => {
            modal.style.display = 'none';
        };

        if (closeBtn) closeBtn.addEventListener('click', hideModal);
        if (cancelBtn) cancelBtn.addEventListener('click', hideModal);
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) hideModal();
        });
    }

    hideModal() {
        const modal = document.getElementById('enrollmentModal');
        if (modal) modal.style.display = 'none';
    }

    hideLoading() {
        const loadingIndicator = document.getElementById('loadingIndicator');
        if (loadingIndicator) {
            loadingIndicator.style.display = 'none';
        }
    }

    escapeHtml(str) {
        if (!str) return '';
        return String(str).replace(/[&<>]/g, function(s) {
            return ({'&': '&amp;', '<': '&lt;', '>': '&gt;'})[s];
        });
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new ClassesManager();
});

// User dropdown and navigation
const user = localStorage.getItem('user');
if (user) {
    const userData = JSON.parse(user);
    const loginBtn = document.getElementById('login-btn');
    const signupBtn = document.getElementById('signup-btn');
    const dashboardBtn = document.getElementById('dashboard-btn');
    
    if (loginBtn) loginBtn.style.display = 'none';
    if (signupBtn) signupBtn.style.display = 'none';
    if (dashboardBtn) dashboardBtn.style.display = 'block';
} else {
    const dashboardBtn = document.getElementById('dashboard-btn');
    if (dashboardBtn) dashboardBtn.style.display = 'none';
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