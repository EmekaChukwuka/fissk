async function uploadToMux(blob, streamName, classId, classTitle) {
    const uploadStatus = document.getElementById('uploadStatus');
    uploadStatus.classList.add('active');
    uploadStatus.innerHTML = '<p>📤 Getting upload URL from Mux…</p>';
    
    try {
        const user = JSON.parse(localStorage.getItem('user'));
        const instructorName = user?.name || 'Instructor';
        
        // 1. Get a direct upload URL from Mux with title
        const uploadResponse = await fetch(`${BACKEND_URL}/api/mux/create-upload`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                streamName: streamName,
                classId: classId,
                classTitle: classTitle,
                instructorName: instructorName,
            }),
        });
        
        if (!uploadResponse.ok) {
            throw new Error(`Mux API error: ${uploadResponse.status}`);
        }
        
        const { success, uploadUrl, uploadId } = await uploadResponse.json();
        
        if (!success) {
            throw new Error('Failed to get upload URL from Mux');
        }
        
        uploadStatus.innerHTML = '<p>📤 Uploading to Mux… (this may take a few minutes)</p>';
        
        // 2. Upload the blob directly to Mux
        const response = await fetch(uploadUrl, {
            method: 'PUT',
            body: blob,
            headers: {
                'Content-Type': 'video/webm',
            },
        });
        
        if (!response.ok) {
            throw new Error(`Upload to Mux failed: ${response.status}`);
        }
        
        uploadStatus.innerHTML = '<p>⏳ Processing upload… Mux is creating your asset</p>';
        
        // 3. Poll for upload completion
        let assetId = null;
        let playbackId = null;
        let attempts = 0;
        const maxAttempts = 60;
        
        while (attempts < maxAttempts) {
            await new Promise(r => setTimeout(r, 5000));
            
            const statusResponse = await fetch(`${BACKEND_URL}/api/mux/upload-status/${uploadId}`);
            const statusData = await statusResponse.json();
            
            if (statusData.status === 'asset_created' || statusData.status === 'ready') {
                assetId = statusData.assetId;
                playbackId = statusData.playbackId;
                console.log(`✅ Mux asset ready: ${assetId}, title: ${classTitle}`);
                break;
            } else if (statusData.status === 'errored') {
                throw new Error('Mux processing failed');
            }
            
            attempts++;
            uploadStatus.innerHTML = `<p>⏳ Processing upload… (${Math.floor(attempts * 5)} seconds)</p>`;
        }
        
        if (!assetId || !playbackId) {
            throw new Error('Upload timed out - asset not ready');
        }
        
        uploadStatus.innerHTML = '<p>✅ Upload complete! Saving to database…</p>';
        
        const duration = Math.floor((Date.now() - streamStartTime) / 1000);
        const minutes = Math.floor(duration / 60);
        
        // 4. Save metadata to your backend
        const saveResponse = await fetch(`${BACKEND_URL}/api/save-stream`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: user?.id,
                streamName: streamName,
                streamClass: currentStreamData.classId,
                classTitle: currentStreamData.title,
                classDescription: currentStreamData.description,
                participants: totalUniqueViewers.size,
                duration: `${minutes} min, ${duration % 60} sec`,
                muxAssetId: assetId,
                muxPlaybackId: playbackId,
            }),
        });
        
        if (!saveResponse.ok) {
            console.warn('Metadata save failed, but video was uploaded');
            showWarning('Video saved to Mux, but metadata save failed. Contact support.');
        }
        
        uploadStatus.classList.remove('active');
        showSuccess(`✅ Recording "${classTitle}" saved to Mux successfully!`);
        return { assetId, playbackId, playbackUrl: `https://stream.mux.com/${playbackId}.m3u8` };
        
    } catch (err) {
        uploadStatus.classList.remove('active');
        console.error('Mux upload error:', err);
        showError(`Mux upload failed: ${err.message}`, null);
        throw err;
    }
}