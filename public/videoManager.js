class VideoManager {
    constructor() {
        this.currentClassId = null;
    }

    async loadClassVideos(classId) {
        try {
            this.currentClassId = classId;
            
            // Show loading state
            this.showLoadingState();

            const response = await fetch(`/api/classes/${classId}/videos`);
            
            if (!response.ok) {
                throw new Error('Failed to load videos');
            }

            const videos = await response.json();
            this.displayVideos(videos);
            
        } catch (error) {
            console.error('Error loading videos:', error);
            this.showError('Failed to load videos. Please try again.');
        }
    }

    displayVideos(videos) {
        const videosContainer = document.getElementById('videosContainer');
        const noVideos = document.getElementById('noVideos');

        if (!videos || videos.length === 0) {
            if (videosContainer) videosContainer.style.display = 'none';
            if (noVideos) noVideos.style.display = 'block';
            return;
        }

        if (noVideos) noVideos.style.display = 'none';
        if (videosContainer) {
            videosContainer.innerHTML = videos.map(video => `
                <div class="video-card" data-video-id="${video.id}">
                    <div class="video-thumbnail" onclick="videoManager.playVideo(${video.id})">
                        <div class="play-overlay">▶</div>
                        <img src="${video.thumbnail_url}" alt="${video.title}" onerror="this.src='/assets/default-thumbnail.jpg'">
                        <div class="video-duration">${video.duration || 'Live'}</div>
                    </div>
                    <div class="video-info">
                        <h4>${video.title}</h4>
                        <p>${video.description || 'Recorded live session'}</p>
                        <div class="video-meta">
                            <span>📅 ${new Date(video.upload_date).toLocaleDateString()}</span>
                            <span>👁️ ${this.formatViews(video.views || 0)}</span>
                        </div>
                    </div>
                </div>
            `).join('');

            videosContainer.style.display = 'grid';
        }
    }

    async playVideo(videoId) {
        try {
            const response = await fetch(`/api/videos/${videoId}`);
            if (!response.ok) throw new Error('Video not found');
            
            const video = await response.json();
            this.showVideoModal(video);
            
        } catch (error) {
            console.error('Error playing video:', error);
            this.showError('Failed to load video.');
        }
    }

    showVideoModal(video) {
        const modal = document.getElementById('videoModal');
        const videoPlayer = document.getElementById('videoPlayer');
        const videoTitle = document.getElementById('videoTitle');
        const videoDescription = document.getElementById('videoDescription');

        videoPlayer.src = video.video_url;
        videoTitle.textContent = video.title;
        videoDescription.textContent = video.description || 'Recorded live session';

        modal.style.display = 'flex';
        videoPlayer.play();

        // Track video view
        this.trackVideoView(video.id);
    }

    async trackVideoView(videoId) {
        try {
            await fetch(`/api/videos/${videoId}/view`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
        } catch (error) {
            console.error('Error tracking view:', error);
        }
    }

    formatViews(views) {
        if (views >= 1000000) {
            return (views / 1000000).toFixed(1) + 'M views';
        } else if (views >= 1000) {
            return (views / 1000).toFixed(1) + 'K views';
        }
        return views + ' views';
    }

    showLoadingState() {
        const videosContainer = document.getElementById('videosContainer');
        if (videosContainer) {
            videosContainer.innerHTML = `
                <div class="loading-videos">
                    <div class="loader"></div>
                    <p>Loading videos...</p>
                </div>
            `;
        }
    }

    showError(message) {
        const videosContainer = document.getElementById('videosContainer');
        if (videosContainer) {
            videosContainer.innerHTML = `
                <div class="error-message">
                    <p>${message}</p>
                    <button onclick="videoManager.loadClassVideos(${this.currentClassId})" class="btn btn-primary">
                        Try Again
                    </button>
                </div>
            `;
        }
    }
}