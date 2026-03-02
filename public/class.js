// Individual Class Page Functionality
class ClassManager {
    constructor() {
        this.classId = this.getClassIdFromURL();
        this.classData = null;
        this.user = JSON.parse(localStorage.getItem('user'));
        if(this.user){
        this.userId = this.user.id;
    }
        this.currentVideoIndex = null;
        this.videoModalBound = false;
        this.progressInterval = null;
        this.videos = [];
        this.init();
    }

    getClassIdFromURL() {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('id');
    }

    async init() {
        if (!this.classId) {
            window.location.href = 'classes.html';
            return;
        }
     //   if(this.user.id){}
        await this.loadClassData();
        await this.loadClassVideos();
        this.setupEventListeners();
        this.renderClassData();
        this.renderVideos();
    }

    async loadClassData() {
        try {
            // Simulate API call - replace with your actual endpoint
            const response = await fetch(`http://localhost:3000/register/class/${this.classId}`);
        
            this.classData = await response.json();
            console.log(this.classData)
            
            // For demo purposes, using mock data
            if (!this.classData) {
                this.classData = this.getMockClassData();
            }
        } catch (error) {
            console.error('Error loading class data:', error);
            this.classData = this.getMockClassData();
        }
    }

    getMockClassData() {
        return {
            id: this.classId,
            title: "French for Canada Express Entry",
            description: "Master TEF/TCF exam requirements and boost your CRS score for Canadian immigration.",
            category: "french",
            level: "beginner",
            duration: "8 weeks",
            students: 245,
            instructor: {
                name: "Mr. Adebayo",
                bio: "Certified French tutor with 8+ years experience preparing students for TEF/TCF exams",
                avatar: "/api/placeholder/100/100"
            },
            enrolled: true,
            progress: 35
        };
    }

    async loadClassVideos() {
        try {
            // Simulate API call - replace with your actual endpoint
            const response = await fetch(`http://localhost:3000/api/by-class/${this.classId}`);
            this.videos = await response.json();
            console.log(this.videos) 
               const responseB = await fetch(`http://localhost:3000/register/user-progress`,{
            method: 'POST',
      headers:{
        'Content-Type':'application/json'
      },
            body: JSON.stringify({userId: this.userId, classId: this.classId}),
        });
        const progress = await responseB.json();


               const res = await fetch(`http://localhost:3000/register/class/upcoming`,{
            method: 'POST',
      headers:{
        'Content-Type':'application/json'
      },
            body: JSON.stringify({id: this.classId}),
        });
        const json = await res.json();
        const upcoming = Array.isArray(json.upcoming) ? json.upcoming : [];
        
        if(upcoming.length==0){
            document.getElementById('upcomingSessions').textContent='No upcoming live sessions yet';
        }else{

            document.getElementById('upcomingSessions').innerHTML=`    ${upcoming.map(s => `
                            <div class="enrolled-class-card upcoming">
                                <div class="session-header"><h4>${this.escapeHtml(s.session_title)}</h4></div>
                                <p>${this.escapeHtml(s.description || '')}</p>
                                <div class="session-details">
                                    <div class="session-info">
                                        <span>📅 ${new Date(s.date).toLocaleDateString()} at ${s.time || ''}</span>
                                          </div><br>
                                    <div class="session-actions">
                                        <button class="btn btn-primary join-session" data-session-id="${s.id}">Join Session</button>
                                    </div>
                                </div>
                            </div><br>
                        `).join('')}`;
                    
        
        }

        console.log(progress)
        // Update progress
        const progressBar = document.getElementById('classProgress');
        const progressText = document.getElementById('progressText');
        if (progressBar && progressText) {
            progressBar.style.width = `${progress.progress[0].progress}%`;
            progressText.textContent = `${progress.progress[0].progress}% Complete`;
        }

            // For demo purposes, using mock data
            if (!this.videos.length) {
                //this.videos = this.getMockVideos();
            }
        } catch (error) {
            console.error('Error loading class videos:', error);
            this.videos = this.getMockVideos();
        }
    }

    getMockVideos() {
        return [
            {
                id: 1,
                title: "Introduction to TEF Exam",
                description: "Overview of TEF exam structure and scoring system",
                duration: "45:30",
                thumbnail: "/api/placeholder/300/200",
                videoUrl: "/api/videos/1",
                date: "2024-01-15"
            },
            {
                id: 2,
                title: "French Pronunciation Basics",
                description: "Mastering French sounds and accents",
                duration: "38:15",
                thumbnail: "/api/placeholder/300/200",
                videoUrl: "/api/videos/2",
                date: "2024-01-22"
            },
            {
                id: 3,
                title: "Common Vocabulary for Immigration",
                description: "Essential words and phrases for Canadian immigration",
                duration: "52:10",
                thumbnail: "/api/placeholder/300/200",
                videoUrl: "/api/videos/3",
                date: "2024-01-29"
            }
        ];
    }

    setupEventListeners() {
        // Tab switching
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });

        // Back to classes button
        const backBtn = document.getElementById('backToClasses');
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                window.location.href = 'classes.html';
            });
        }

        // Enrollment button
        const enrollBtn = document.getElementById('enrollBtn');
        if (enrollBtn) {
            enrollBtn.addEventListener('click', () => {
                this.handleEnrollment();
            });
        }

        // Video modal
        this.setupVideoModal();
    }

    switchTab(tabName) {
        // Update active tab button
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });

        // Show active tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('active', content.id === `${tabName}Tab`);
        });
    }

   async renderClassData() {
        if (!this.classData) return;
try{
 const response = await fetch('http://localhost:3000/register/classes/instructor',{
            method: 'POST',
      headers:{
        'Content-Type':'application/json'
      },
            body: JSON.stringify({instructor_id: this.classData.classA[0].instructor_id}),
        }); 
    
    const dataA =await response.json();
    console.log(dataA);
        // Update page title
        document.title = `${this.classData.classA[0].title} - FISSK Online Academy`;

        // Update hero section
        document.getElementById('className').textContent = this.classData.classA[0].title;
        document.getElementById('classDescription').textContent = this.classData.classA[0].description;
        
        // Update meta information
        document.getElementById('classLevel').textContent = `🟢 ${this.classData.classA[0].level}`;
        document.getElementById('classDuration').textContent = `🕒 ${this.classData.classA[0].duration}`;
        document.getElementById('classStudents').textContent = `👥 ${this.classData.classA[0].max_students} Students`;

        // Update enrollment button
        const enrollBtn = document.getElementById('enrollBtn');
        if (this.classData.enrolled) {
            enrollBtn.textContent = 'Already Enrolled';
            enrollBtn.disabled = true;
        }

        // Update instructor info
        const instructor = this.classData.instructor;
        document.getElementById('instructorName').textContent = dataA.instructorData.first_name + ' ' + dataA.instructorData.last_name;
        document.getElementById('instructorBio').textContent = `Certified ${this.classData.classA[0].title} Tutor`;

        // Update class details
        this.renderClassDetails();
    }catch(err){
        conole.log(err);
    }
    }

    renderClassDetails() {
        const detailsContent = document.getElementById('classDetailsContent');
        if (!detailsContent) return;
const syllabus = JSON.stringify(this.classData.classA[0].syllabus);
        detailsContent.innerHTML = `
            <div class="class-details">
                <h4>Course Overview</h4>
                <p>${this.classData.classA[0].description}</p>
                
            </div>
        `;
    }

    renderVideos() {
        const videosContainer = document.getElementById('videosContainer');
        const noVideos = document.getElementById('noVideos');

        if (!this.videos.length) {
            if (videosContainer) videosContainer.style.display = 'none';
            if (noVideos) noVideos.style.display = 'block';
            return;
        }
        
        if (noVideos) noVideos.style.display = 'none';
        if (videosContainer) {
            videosContainer.innerHTML = this.videos.map((video, index) => `
                <div class="video-card" data-video-id="${index}">
                    <div class="video-thumbnail" style="background: linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%);"></div>
                    <div class="video-info">
                        <h4>${video.videoDetails.title}</h4>
                        <p>${video.videoDetails.description}</p>
                        <div class="video-meta">
                            <span>${video.videoDetails.duration}</span>
                            <span>${new Date(video.videoDetails.date).toLocaleDateString()}</span>
                        </div>
                    </div>
                </div>
            `).join('');

            // Add click event to video cards
            videosContainer.querySelectorAll('.video-card').forEach(card => {
                card.addEventListener('click', () => {
                    const videoId = card.dataset.videoId;          
                    this.playVideo(videoId);
                });
            });
        }
    }
    playVideo(videoId) {

    this.currentVideoIndex =Number(videoId);
  //  console.log(this.videos)
        const video = this.videos[videoId];
        if (!video) return null;

        const modal = document.getElementById('videoModal');
        const videoPlayer = document.getElementById('videoPlayer');
        const videoTitle = document.getElementById('videoTitle');
        const videoDescription = document.getElementById('videoDescription');
        
        videoPlayer.src = `${video.url}`;
        videoTitle.textContent = video.videoDetails.title;
        videoDescription.textContent = video.videoDetails.description;

        modal.style.display = 'flex';

   // 🔁 Resume progress
    this.restoreProgress(videoPlayer, videoId);

   // videoPlayer.play();

    // ▶️ Autoplay next
    videoPlayer.onended = () => {
        this.markCompleted(videoId);
    };

    // 💾 Save progress
    this.trackProgress(videoPlayer, videoId);

    /*// ✅ Mark complete manually
    if (completeBtn) {
        completeBtn.onclick = () => this.markCompleted(videoId);
    }*/

        // Close modal when video ends or when close button is clicked
        const closeModal = () => {
            modal.style.display = 'none';
            videoPlayer.pause();
            videoPlayer.currentTime = 0;
        };

        document.querySelector('.close-modal').onclick = closeModal;
        modal.onclick = (e) => {
            if (e.target === modal) closeModal();
        };

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.style.display === 'flex') {
            closeModal();
        }
    });
    }

    trackProgress(videoPlayer, videoId) {
    clearInterval(this.progressInterval);

    this.progressInterval = setInterval(() => {
        if (!videoPlayer.paused && !videoPlayer.ended) {
            const progress = {
                time: videoPlayer.currentTime,
                duration: videoPlayer.duration
            };

            localStorage.setItem(
                `video_progress_${videoId}`,
                JSON.stringify(progress)
            );

            // 🔌 OPTIONAL backend save
            fetch('/register/progress/update', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    progress: progress.time, 
                    userId: this.userId,
                    classId: this.classId
                })
            }).catch(() => {});
        }
    }, 5000);
}

restoreProgress(videoPlayer, videoId) {
    const saved = localStorage.getItem(`video_progress_${videoId}`);
    if (!saved) return;

    try {
        const { time } = JSON.parse(saved);
        videoPlayer.currentTime = time || 0;
    } catch {}
}

async markCompleted(videoId) {
    localStorage.removeItem(`video_progress_${videoId}`);

    await fetch('/api/student/complete-video', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ video_id: videoId })
    }).catch(() => {});

    this.highlightCompletedVideo(videoId);
}

highlightCompletedVideo(videoId) {
    document.querySelectorAll('.video-card').forEach(card => {
        if (card.dataset.videoId == videoId) {
            card.classList.add('completed');
        }
    });
}

closeVideoModal() {
    const modal = document.getElementById('videoModal');
    const videoPlayer = document.getElementById('videoPlayer');

    clearInterval(this.progressInterval);

    videoPlayer.pause();
    videoPlayer.currentTime = 0;
    videoPlayer.src = '';

    modal.style.display = 'none';
}


    setupVideoModal() {
        // Additional video modal setup if needed
    }

  escapeHtml(str) {
            if (!str) return '';
            return String(str).replace(/[&<>"]/g, function (s) {
                return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[s];
            });
        }

    async handleEnrollment() {
        if (this.classData.enrolled) {
            alert('You are already enrolled in this class!');
            return;
        }

        try {
            const user = JSON.parse(localStorage.getItem('user'));
            const email = user.email;
            // Simulate API call - replace with your actual endpoint
            const response = await fetch('/register/join-class', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ classId: this.classId, email })
            });

            if (response.ok) {
                this.classData.enrolled = true;
                this.renderClassData();
                alert('Successfully enrolled in the class!');
            } else {
                throw new Error('Enrollment failed');
            }
        } catch (error) {
            console.error('Error enrolling in class:', error);
            alert('Failed to enroll in class. Please try again.');
        }
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new ClassManager();
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