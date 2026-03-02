class InstructorClassDetails {

constructor(){
    this.classId = new URLSearchParams(location.search).get('id');
    this.currentUser = JSON.parse(localStorage.getItem('user'));
    this.token = localStorage.getItem('token');
    this.init();
}

async init(){
    await this.loadClass();
    await this.loadVideos();
    await this.loadStudents();
    await this.loadStreams();
    this.bindTabs();
}

headers(){
    return {
        'Content-Type': 'application/json',
    };
}

bindTabs(){
    document.querySelectorAll('.tab-btn').forEach(btn=>{
        btn.onclick = ()=>{
            document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c=>c.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(btn.dataset.tab + 'Tab').classList.add('active');
        };
    });
}

async loadClass(){
    const res = await fetch(`/register/instructor/classes/${this.classId}`, { 
                    method: 'POST', 
                    headers:this.headers() ,
                    body: JSON.stringify({ id : this.currentUser.id })
                  });
    const c = await res.json();

    className.textContent = c.title;
    classDescription.textContent = c.description;
    classCategory.textContent = c.category;
    classLevel.textContent = c.level;
    classDuration.textContent = c.duration;
    classStudents.textContent = `👥 ${c.student_count} Students`;
}

async loadVideos(){
    const res = await fetch(`/api/by-class/${this.classId}`, { headers:this.headers() ,
                   });
    const videos = await res.json();

     videosContainer.innerHTML = videos.map((video, index) => `
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
                    
            <button class='btn btn-primary' onclick="manager.deleteVideo(${video.id})" style="margin-left:30%;margin-bottom:5%;">Delete</button>
                </div>
            `).join(''); 
            
            videosContainer.querySelectorAll('.video-card').forEach(card => {
                card.addEventListener('click', () => {
                    const videoId = card.dataset.videoId;          
                    this.playVideo(videoId, videos);
                });
            });
}

    playVideo(videoId, videos) {

    this.currentVideoIndex =Number(videoId);
  //  console.log(this.videos)
        const video = videos[videoId];
        console.log(video)
        if (!video) return null;

        const modal = document.getElementById('videoModal');
        const videoPlayer = document.getElementById('videoPlayer');
        const videoTitle = document.getElementById('videoTitle');
        const videoDescription = document.getElementById('videoDescription');
        
        videoPlayer.src = `${video.url}`;
        videoTitle.textContent = video.videoDetails.title;
        videoDescription.textContent = video.videoDetails.description;

        modal.style.display = 'flex';

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

async loadStudents(){
    const res = await fetch(`/register/instructor/classes/${this.classId}/students`, { headers:this.headers() ,
                   });
    const students = await res.json();

    studentsContainer.innerHTML = `<table class="enrollments-table">
        <thead>
          <tr><th>Student</th><th>Email</th><th>Joined</th><th>Progress</th><th>Last Accessed</th></tr>
        </thead><tbody>
    ${students.map(s=>`
       
            <tr>
              <td>${this.escapeHtml(s.name|| (s.first_name + ' ' + s.last_name) || '—')}</td>
              <td>${this.escapeHtml(s.email || '—')}</td>
              <td>${s.enrolled_at ? new Date(s.enrolled_at).toLocaleDateString() : '—'}</td>
              <td>
                <div class="progress-bar small"><div class="progress-fill" style="width:${s.progress||0}%"></div></div>
                <span>${s.progress||0}%</span>
              </td>
              <td>${s.last_accessed ? new Date(s.last_accessed).toLocaleDateString() : 'Never'}</td>
            </tr>
    `).join('')}
        </tbody>
      </table>`;
}

async loadStreams(){
    const res = await fetch(`/register/instructor/classes/${this.classId}/streams`, { headers:this.headers(),
                   });
    const streams = await res.json();

    streamsContainer.innerHTML = streams.map(s=>`
        <div class="stream-card">
            <h4>${s.title}</h4>
            <p>${new Date(s.date).toLocaleString()}</p>
            <button onclick="manager.cancelStream(${s.id})">Cancel</button>
        </div>
    `).join('');
}

async deleteVideo(id){
    await fetch(`/register/instructor/videos/${id}`, {
        method:'DELETE',
        headers:this.headers(),
                    body: JSON.stringify({ id: this.currentUser.id })
    });
    this.loadVideos();
}

async cancelStream(id){
    await fetch(`/register/instructor/streams/${id}`, {
        method:'DELETE',
                    body: JSON.stringify({ id: this.currentUser.id })
    });
    this.loadStreams();
}

 escapeHtml(s) { if (!s) return ''; return String(s).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"})[ch]); }

}

const manager = new InstructorClassDetails();
