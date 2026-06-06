import express from "express";
import multer from "multer";
import Stream from "../models/Stream.js";
import LiveSession from "../models/LiveSession.js";
import Mux from '@mux/mux-node';

const router = express.Router();

// ===== MUX CONFIGURATION =====
const mux = new Mux({
  tokenId: process.env.MUX_TOKEN_ID,
  tokenSecret: process.env.MUX_TOKEN_SECRET,
});

// Local storage fallback (if needed)
const localStorage = multer.diskStorage({
  destination: 'uploads/',
  filename: function(req, file, cb) {
    cb(null, file.originalname);
  }
});

const localUpload = multer({
  storage: localStorage,
  limits: { fileSize: 500000000 }
});

// ===== MUX ENDPOINTS =====

// Create a direct upload URL for Mux with title support
router.post('/mux/create-upload', async (req, res) => {
  try {
    const { streamName, classId, classTitle, instructorName } = req.body;
    
    // Create a direct upload URL with proper naming
    const upload = await mux.video.uploads.create({
      cors_origin: '*',
      new_asset_settings: {
        // Set the actual asset name (displayed in Mux dashboard)
        playback_policy: ['public'],
        max_resolution_tier: '1080p',
        // This is the title that will appear in Mux dashboard
        asset_name: `${classTitle} - ${new Date().toLocaleDateString()}`,
        // Store additional metadata as passthrough
        passthrough: JSON.stringify({
          streamName,
          classId,
          title: classTitle,
          instructorName,
          source: 'fissk-frontend-upload',
          recordedAt: new Date().toISOString()
        }),
      },
    });
    
    console.log(`✅ Mux upload created: ${upload.id} for "${classTitle}"`);
    
    res.json({
      success: true,
      uploadUrl: upload.url,
      uploadId: upload.id,
    });
  } catch (error) {
    console.error('Create Mux upload error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get upload status and asset details
router.get('/mux/upload-status/:uploadId', async (req, res) => {
  try {
    const { uploadId } = req.params;
    
    const upload = await mux.video.uploads.retrieve(uploadId);
    
    let assetId = null;
    let playbackId = null;
    let assetName = null;
    
    if (upload.asset_id) {
      assetId = upload.asset_id;
      const asset = await mux.video.assets.retrieve(assetId);
      playbackId = asset.playback_ids?.[0]?.id;
      assetName = asset.name; // Get the asset name back
    }
    
    res.json({
      success: true,
      status: upload.status,
      assetId: assetId,
      playbackId: playbackId,
      assetName: assetName,
    });
  } catch (error) {
    console.error('Get Mux upload status error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Save stream with Mux data (updated to include asset name)
router.post('/save-stream', async (req, res) => {
  try {
    const { 
      userId, 
      streamName, 
      streamClass, 
      classTitle, 
      classDescription, 
      participants, 
      duration,
      muxAssetId,
      muxPlaybackId
    } = req.body;
    
    if (!muxAssetId || !muxPlaybackId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Mux asset ID and playback ID are required' 
      });
    }
    
    // Create stream record in database
    const streamId = await Stream.create({
      userId,
      name: streamName,
      filename: `${streamName}.mp4`,
      size: 0,
      streamClass,
      classTitle,
      classDescription,
      participants: participants || 0,
      duration: duration || '0:00',
      muxAssetId: muxAssetId,
      muxPlaybackId: muxPlaybackId,
    });
    
    // Create corresponding live session record
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    await LiveSession.create({
      instructorId: userId,
      classId: streamClass,
      title: classTitle || streamName,
      description: classDescription || '',
      date: today,
      duration: duration || '0:00',
      participants: participants || 0,
      sessionType: 'recorded',
      muxAssetId: muxAssetId,
      muxPlaybackId: muxPlaybackId,
    });
    
    console.log(`✅ Stream saved to DB: ${streamId}, Mux asset: ${muxAssetId}, Title: ${classTitle}`);
    
    res.json({
      success: true,
      streamId,
      playbackId: muxPlaybackId,
      playbackUrl: `https://stream.mux.com/${muxPlaybackId}.m3u8`,
      assetName: classTitle,
    });
  } catch (error) {
    console.error('Save stream error:', error);
    res.status(400).json({ success: false, message: error.message });
  }
});

// Update Mux asset title after upload (if needed)
router.post('/mux/update-asset-title/:assetId', async (req, res) => {
  try {
    const { assetId } = req.params;
    const { title } = req.body;
    
    if (!title) {
      return res.status(400).json({ success: false, message: 'Title is required' });
    }
    
    // Update the asset name in Mux
    const asset = await mux.video.assets.update(assetId, {
      name: title,
    });
    
    console.log(`✅ Updated Mux asset title: ${assetId} -> "${title}"`);
    
    res.json({
      success: true,
      assetId: asset.id,
      name: asset.name,
    });
  } catch (error) {
    console.error('Update asset title error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get Mux thumbnail
router.get('/mux/thumbnail/:playbackId', async (req, res) => {
  const { playbackId } = req.params;
  const time = req.query.time || 5;
  
  res.json({
    thumbnailUrl: `https://image.mux.com/${playbackId}/thumbnail.jpg?time=${time}`,
    storyboardUrl: `https://image.mux.com/${playbackId}/storyboard.vtt`,
  });
});

// Get all past streams
router.get('/past-streams', async (req, res) => {
  try {
    const streams = await Stream.getAll();
    
    const streamsWithUrls = streams.map(stream => ({
      ...stream,
      playbackUrl: stream.muxPlaybackId ? 
        `https://stream.mux.com/${stream.muxPlaybackId}.m3u8` : null,
      thumbnailUrl: stream.muxPlaybackId ?
        `https://image.mux.com/${stream.muxPlaybackId}/thumbnail.jpg?time=5` : null,
      storyboardUrl: stream.muxPlaybackId ?
        `https://image.mux.com/${stream.muxPlaybackId}/storyboard.vtt` : null,
    }));
    
    res.json({ success: true, streams: streamsWithUrls });
  } catch (error) {
    console.error('Get past streams error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get HLS streaming URL for a recorded stream
router.get('/stream-hls/:streamId', async (req, res) => {
  try {
    const { streamId } = req.params;
    const stream = await Stream.getById(streamId);
    
    if (!stream || !stream.muxPlaybackId) {
      return res.status(404).json({ success: false, message: 'Stream not found' });
    }
    
    res.json({
      success: true,
      hlsUrl: `https://stream.mux.com/${stream.muxPlaybackId}.m3u8`,
      thumbnailUrl: `https://image.mux.com/${stream.muxPlaybackId}/thumbnail.jpg?time=5`,
    });
  } catch (error) {
    console.error('Get stream HLS error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get streams by class
router.get('/by-class/:classId', async (req, res) => {
  try {
    const { classId } = req.params;
    const StreamModel = (await import('../models/Stream.js')).default;
    
    const streams = await StreamModel.find({ streamClass: classId })
      .sort({ createdAt: -1 })
      .lean();
    
    const classVideos = streams.map(stream => ({
      _id: stream._id,
      filename: stream.filename,
      title: stream.classTitle,
      description: stream.classDescription,
      playbackUrl: stream.muxPlaybackId ? 
        `https://stream.mux.com/${stream.muxPlaybackId}.m3u8` : null,
      thumbnailUrl: stream.muxPlaybackId ?
        `https://image.mux.com/${stream.muxPlaybackId}/thumbnail.jpg?time=5` : null,
      storyboardUrl: stream.muxPlaybackId ?
        `https://image.mux.com/${stream.muxPlaybackId}/storyboard.vtt` : null,
      uploadDate: stream.createdAt,
      duration: stream.duration,
      participants: stream.participants,
    }));
    
    res.json(classVideos);
  } catch (error) {
    console.error('Get videos by class error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Delete stream from Mux
router.delete('/delete-stream/:streamId', async (req, res) => {
  try {
    const { streamId } = req.params;
    const stream = await Stream.getById(streamId);
    
    if (!stream) {
      return res.status(404).json({ success: false, message: 'Stream not found' });
    }
    
    // Delete from Mux if asset exists
    if (stream.muxAssetId) {
      try {
        await mux.video.assets.del(stream.muxAssetId);
        console.log(`Deleted Mux asset: ${stream.muxAssetId} - ${stream.classTitle}`);
      } catch (muxError) {
        console.error('Mux delete error:', muxError);
      }
    }
    
    // Delete from database
    await Stream.delete(streamId);
    
    res.json({ success: true, message: 'Stream deleted successfully' });
  } catch (error) {
    console.error('Delete stream error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get stream comments
router.get('/stream-comments', async (req, res) => {
  try {
    const { streamId } = req.query;
    if (!streamId) throw new Error('Stream ID required');
    
    const stream = await Stream.getById(streamId);
    res.json({ 
      success: true, 
      comments: stream ? stream.comments : [] 
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Add comment
router.post('/add-comment', async (req, res) => {
  try {
    const { streamId, userId, userName, message } = req.body;
    if (!streamId || !userId || !userName || !message) {
      throw new Error('Missing required fields');
    }
    
    await Stream.addComment(streamId, userId, userName, message);
    res.json({ success: true, message: 'Comment added' });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

export default router;