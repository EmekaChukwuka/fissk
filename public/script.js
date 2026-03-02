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

// Form handling
document.addEventListener('DOMContentLoaded', function() {
    const forms = document.querySelectorAll('form');
    
    forms.forEach(form => {
        form.addEventListener('submit', function(e) {
            e.preventDefault();
            
            // Basic form validation
            let isValid = true;
            const inputs = this.querySelectorAll('input[required], textarea[required]');
            
            inputs.forEach(input => {
                if (!input.value.trim()) {
                    isValid = false;
                    input.style.borderColor = 'red';
                } else {
                    input.style.borderColor = '';
                }
            });
            
            if (isValid) {
                // Show success message
                alert('Form submitted successfully! We\'ll get back to you soon.');
                this.reset();
            } else {
                alert('Please fill in all required fields.');
            }
        });
    });
});

// Dashboard functionality
document.addEventListener('DOMContentLoaded', function() {
    // Progress bars animation
    const progressBars = document.querySelectorAll('.progress-fill');
    
    progressBars.forEach(bar => {
        const width = bar.style.width;
        bar.style.width = '0';
        setTimeout(() => {
            bar.style.width = width;
        }, 500);
    });
    
    // Course completion tracking
    const completeButtons = document.querySelectorAll('.complete-btn');
    
    completeButtons.forEach(button => {
        button.addEventListener('click', function() {
            const courseCard = this.closest('.course-card');
            const progress = courseCard.querySelector('.progress-fill');
            
            this.textContent = 'Completed ✓';
            this.disabled = true;
            this.style.background = '#48BB78';
            
            // Update progress bar
            progress.style.width = '100%';
            
            // Show completion message
            alert('Course marked as completed! Great job!');
        });
    });
});



// Call this function when dashboard loads
if (window.location.pathname.includes('dashboard.html')) {
    document.addEventListener('DOMContentLoaded', loadEnrolledClasses);
}

// Classes Page Functionality
class ClassesManager {
    constructor() {
        this.classes = [];
        this.filteredClasses = [];
        this.currentFilter = 'all';
        this.init();
    }

    async init() {
        await this.loadClasses();
        this.renderClasses();
    }

    async loadClasses() {
        try {
            

             const response = await fetch('http://localhost:3000/register/classes-on-homepage');
    
    const data =await response.json();
    console.log(data);
    const coursesArray = data.classes;
    if(coursesArray.length!==0){
this.classes = coursesArray;

}
    console.log(data);
  

            // For demo purposes, using mock data
            if (!this.classes.length) {
                this.classes = this.getMockClasses();
            }
            
            this.filteredClasses = [...this.classes];
            this.hideLoading();
        } catch (error) {
            console.error('Error loading classes:', error);
            this.classes = this.getMockClasses();
            this.filteredClasses = [...this.classes];
            this.hideLoading();
        }
    }

    getMockClasses() {
        return [
            {
                id: 1,
                title: "French for Canada Express Entry",
                description: "Master TEF/TCF exam requirements and boost your CRS score for Canadian immigration.",
                category: "french",
                level: "beginner",
                duration: "8 weeks",
                students: 245,
                instructor: "Mr. Adebayo",
                thumbnail: "/api/placeholder/400/200",
                enrolled: false
            },
            {
                id: 2,
                title: "IELTS Academic Excellence",
                description: "Achieve band 7.0+ with our proven strategies and comprehensive practice tests.",
                category: "english",
                level: "intermediate",
                duration: "6 weeks",
                students: 189,
                instructor: "Mrs. Johnson",
                thumbnail: "/api/placeholder/400/200",
                enrolled: false
            },
            {
                id: 3,
                title: "Business French for Professionals",
                description: "Communicate confidently in corporate settings and international business meetings.",
                category: "french",
                level: "advanced",
                duration: "10 weeks",
                students: 78,
                instructor: "Dr. Chukwu",
                thumbnail: "/api/placeholder/400/200",
                enrolled: true
            },
            {
                id: 4,
                title: "English for Career Growth",
                description: "Enhance your professional communication skills for workplace success.",
                category: "english",
                level: "intermediate",
                duration: "8 weeks",
                students: 156,
                instructor: "Ms. Bello",
                thumbnail: "/api/placeholder/400/200",
                enrolled: false
            }
        ];
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
        
        // Update active filter button
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
                                classItem.classname.toLowerCase().includes(this.searchQuery) ||
                                classItem.classDescription.toLowerCase().includes(this.searchQuery);
            
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
        container.innerHTML = this.filteredClasses.map(classItem => `
            <div class="class-card" data-class-id="${classItem.id}">
                <div class="class-card-image" style="background: linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%);"></div>
                <div class="class-card-content">
                    <h3>${classItem.title}</h3>
                    <p>${classItem.description}</p>
                    <div class="class-meta">
                        <span>🟢 ${classItem.level}</span>
                        <span>🕒 ${classItem.duration}</span>
                        <span>👥 ${classItem.max_students} students</span>
                    </div>
                    <div class="class-actions">
                        ${classItem.enrolled ? 
                            `<button class="btn btn-outline" disabled>Already Enrolled</button>
                             <a href="class.html?id=${classItem.id}" class="btn btn-primary">Continue Learning</a>` :
                            `<button class="btn btn-primary enroll-btn" data-class-id="${classItem.id}" id="${classItem.id}">Enroll Now</button>
                             <a href="class.html?id=${classItem.id}" class="btn btn-outline">View Details</a>`
                        }
                    </div>
                </div>
            </div>
        `).join('');

        // Add event listeners to enroll buttons
        document.querySelectorAll('.enroll-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const classId = e.target.id;
                this.showEnrollmentModal(classId);
            });
        });
    }

   

    hideLoading() {
        const loadingIndicator = document.getElementById('loadingIndicator');
        if (loadingIndicator) {
            loadingIndicator.style.display = 'none';
        }
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new ClassesManager();
});

const user = localStorage.getItem('user');
if(user){
    document.getElementById('login-btn').style.display = 'none';
    document.getElementById('signup-btn').style.display = 'none';
}
if(!user){
    document.getElementById('dashboard-btn').style.display = 'none';
}