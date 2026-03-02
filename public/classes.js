
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
         this.setupEventListeners();
        this.renderClasses();
    }

    async loadClasses() {
        try {
            

             const response = await fetch('http://localhost:3000/register/classes');
    
    const data =await response.json();
    console.log(data);
    const coursesArray = data.classes;
    if(coursesArray.length!==0){
this.classes = coursesArray;

   /* for (let i = 0; i < coursesArray.length; i++) {
        const classA = data.classes[i];
        console.log(classA);
        let section = document.createElement('section');
        section.className = "home-sections";
        classes.append(section);
        let sectionHeader = document.createElement('h4');
        let sectionDes = document.createElement('p');
        let sectionP = document.createElement('p');
        let sectionLink = document.createElement('a');
        sectionLink.className = "visitclass";
        section.appendChild(sectionHeader);
        section.appendChild(sectionP);
        section.appendChild(sectionDes);
        section.appendChild(sectionLink);
        sectionLink.innerHTML = "Visit Class";
        sectionLink.addEventListener('click', () => {window.location.href="class.html"});
        sectionHeader.innerHTML = classA['classname'];
        sectionDes.innerHTML = classA['classDescription'] + '<br><br>';
        sectionP.innerHTML = 'Instructor: ' + classA['Instructor'];
    }*/
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
                            `<button class="btn btn-primary enroll-btn" data-class-id="${classItem.id}" data-class-name="${classItem.title}" id="${classItem.id}">Enroll Now</button>
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

 async showEnrollmentModal(classId) {
        const classItem = this.classes.find(c => c.id == classId);
        if (!classItem) console.log('error');

        const modal = document.getElementById('enrollmentModal');
        const modalContent = document.getElementById('modalClassDetails');
        try{

           const response = await fetch('http://localhost:3000/register/classes/instructor',{
            method: 'POST',
      headers:{
        'Content-Type':'application/json'
      },
            body: JSON.stringify({instructor_id: classItem.instructor_id}),
        }); 
    
    const dataA =await response.json();
    console.log(dataA);
        modalContent.innerHTML = `
            <h3>${classItem.title}</h3>
            <p><strong>Category:</strong> ${classItem.category.toUpperCase()}</p>
            <p><strong>Level:</strong> ${classItem.level}</p>
            <p><strong>Duration:</strong> ${classItem.duration}</p>
            <p><strong>Instructor:</strong> ${dataA.instructorData.first_name} ${dataA.instructorData.last_name} </p>
            <p>${classItem.description}</p><br>
        `;

        modal.style.display = 'flex';

        // Set up confirmation button
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
    }catch(err){
        console.log(err);
    }
    }

    async enrollInClass(classId) {
        try {
            const user = JSON.parse(localStorage.getItem('user'));
            const email = user.email;
            console.log(email)
            // Simulate API call - replace with your actual endpoint
            const response = await fetch('/register/join-class', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ classId: classId, email })
            });

            if (response.ok) {
                // Update local state
                const classItem = this.classes.find(c => c.id == classId);
                if (classItem) {
                    classItem.enrolled = true;
                }
                
                this.hideModal();
                this.renderClasses();
                
                // Show success message
                alert('Successfully enrolled in the class!');
                
                // Redirect to class page
                window.location.href = `class.html?id=${classId}`;
            } else {
                throw new Error('Enrollment failed');
            }
        } catch (error) {
            console.error('Error enrolling in class:', error);
            alert('Failed to enroll in class. Please try again.');
        }
    }

    setupModalEvents() {
        const modal = document.getElementById('enrollmentModal');
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
    }

    hideModal() {
        document.getElementById('enrollmentModal').style.display = 'none';
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