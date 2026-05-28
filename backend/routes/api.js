import express from "express";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import Stream from "../models/Stream.js";
import LiveSession from "../models/LiveSession.js";
import fs from 'fs';
import path from "path";

const router = express.Router();

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Configure Cloudinary storage for multer
const cloudinaryStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: (req, file) => {
      const { streamClass, classTitle } = req.body;
      return `livestreams/${streamClass || 'general'}/${classTitle || 'untitled'}`;
    },
    resource_type: 'video',
    allowed_formats: ['webm', 'mp4', 'mov'],
    public_id: (req, file) => {
      const { streamName } = req.body;
      return streamName || `stream_${Date.now()}`;
    },
    transformation: [
      { quality: 'auto' },
      { fetch_format: 'auto' }
    ]
  }
});

// Multer configuration for Cloudinary
const upload = multer({
  storage: cloudinaryStorage,
  limits: { fileSize: 500000000 }, // 500MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['video/webm', 'video/mp4', 'video/quicktime'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only webm, mp4, and mov are allowed!'), false);
    }
  }
});

// Alternative: Local storage as fallback (optional)
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

// Helper function to generate signed upload URL
router.post('/cloudinary/sign-upload', async (req, res) => {
  try {
    const { folder, publicId, resourceType = 'video' } = req.body;
    const timestamp = Math.round(Date.now() / 1000);
    
    const signature = cloudinary.utils.api_sign_request({
      timestamp: timestamp,
      folder: folder || 'livestreams',
      public_id: publicId,
      resource_type: resourceType
    }, process.env.CLOUDINARY_API_SECRET);
    
    res.json({
      success: true,
      signature,
      timestamp,
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      folder: folder || 'livestreams'
    });
  } catch (error) {
    console.error('Sign upload error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Save recorded livestream to Cloudinary
router.post('/save-stream', upload.single('video'), async (req, res) => {
  try {
    const { 
      userId, 
      streamName, 
      streamClass, 
      classTitle, 
      classDescription, 
      participants, 
      duration,
      cloudinaryUrl,
      cloudinaryPublicId
    } = req.body;
    
    // If file was uploaded via multer to Cloudinary
    let finalCloudinaryUrl = cloudinaryUrl;
    let finalCloudinaryPublicId = cloudinaryPublicId;
    let fileSize = 0;
    let filename = streamName;
    
    if (req.file) {
      finalCloudinaryUrl = req.file.path;
      finalCloudinaryPublicId = req.file.filename;
      fileSize = req.file.size;
      filename = req.file.originalname;
    }
    
    // Create stream record in database
    const result = await Stream.create({
      userId,
      name: streamName,
      filename: filename,
      size: fileSize,
      streamClass,
      classTitle,
      classDescription,
      participants: participants || 0,
      duration: duration || '0:00',
      cloudinaryUrl: finalCloudinaryUrl,
      cloudinaryPublicId: finalCloudinaryPublicId
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
      cloudinaryUrl: finalCloudinaryUrl,
      cloudinaryPublicId: finalCloudinaryPublicId
    });
    
    res.json({
      success: true,
      streamId: result.streamId || result._id,
      filename,
      cloudinaryUrl: finalCloudinaryUrl,
      cloudinaryPublicId: finalCloudinaryPublicId
    });
  } catch (error) {
    console.error('Save stream error:', error);
    res.status(400).json({ success: false, message: error.message });
  }
});

// Get Cloudinary upload signature for direct client upload
router.post('/cloudinary/upload-signature', async (req, res) => {
  try {
    const { folder, publicId, tags } = req.body;
    const timestamp = Math.round(Date.now() / 1000);
    
    const params = {
      timestamp: timestamp,
      folder: folder || 'livestreams',
      resource_type: 'video'
    };
    
    if (publicId) params.public_id = publicId;
    if (tags) params.tags = tags;
    
    const signature = cloudinary.utils.api_sign_request(params, process.env.CLOUDINARY_API_SECRET);
    
    res.json({
      signature,
      timestamp,
      cloudname: process.env.CLOUDINARY_CLOUD_NAME,
      apiKey: process.env.CLOUDINARY_API_KEY,
      ...params
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get past streams with Cloudinary URLs
router.get('/past-streams', async (req, res) => {
  try {
    const streams = await Stream.getAll();
    
    // Add Cloudinary optimized URLs
    const streamsWithUrls = streams.map(stream => ({
      ...stream,
      playbackUrl: stream.cloudinaryUrl ? 
        cloudinary.url(stream.cloudinaryPublicId, {
          resource_type: 'video',
          quality: 'auto',
          fetch_format: 'auto'
        }) : null,
      thumbnailUrl: stream.cloudinaryPublicId ?
        cloudinary.url(stream.cloudinaryPublicId, {
          resource_type: 'video',
          format: 'jpg',
          transformation: [
            { start_offset: '5' },
            { width: 320, height: 180, crop: 'fill' }
          ]
        }) : null
    }));
    
    res.json({ success: true, streams: streamsWithUrls });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get HLS streaming URL for a recorded stream
router.get('/stream-hls/:streamId', async (req, res) => {
  try {
    const { streamId } = req.params;
    const stream = await Stream.getById(streamId);
    
    if (!stream || !stream.cloudinaryPublicId) {
      return res.status(404).json({ success: false, message: 'Stream not found' });
    }
    
    // Generate HLS URL for adaptive streaming
    const hlsUrl = cloudinary.url(stream.cloudinaryPublicId, {
      resource_type: 'video',
      format: 'm3u8',
      streaming_profile: 'full_hd',
      quality: 'auto'
    });
    
    res.json({
      success: true,
      hlsUrl,
      mp4Url: stream.cloudinaryUrl,
      thumbnail: cloudinary.url(stream.cloudinaryPublicId, {
        resource_type: 'video',
        format: 'jpg',
        transformation: { start_offset: '5' }
      })
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get streams by class with Cloudinary data
router.get('/by-class/:classId', async (req, res) => {
  try {
    const classId = req.params.classId;
    
    // Get streams from database
    const streams = await StreamModel.find({ streamClass: classId })
      .sort({ createdAt: -1 })
      .lean();
    
    // Also fetch from Cloudinary directly for any missing streams
    let cloudinaryResources = [];
    try {
      const result = await cloudinary.api.resources({
        type: 'upload',
        prefix: `livestreams/${classId}`,
        resource_type: 'video',
        max_results: 50
      });
      cloudinaryResources = result.resources || [];
    } catch (err) {
      console.log('Cloudinary fetch optional:', err.message);
    }
    
    // Combine database streams with Cloudinary resources
    const allStreams = [...streams];
    
    for (const cloudRes of cloudinaryResources) {
      if (!allStreams.some(s => s.cloudinaryPublicId === cloudRes.public_id)) {
        allStreams.push({
          cloudinaryUrl: cloudRes.secure_url,
          cloudinaryPublicId: cloudRes.public_id,
          name: cloudRes.public_id.split('/').pop(),
          filename: cloudRes.public_id,
          size: cloudRes.bytes,
          duration: Math.floor(cloudRes.duration),
          createdAt: cloudRes.created_at,
          participants: 0
        });
      }
    }
    
    // Generate thumbnails and HLS URLs
    const classVideos = allStreams.map(stream => {
      const publicId = stream.cloudinaryPublicId;
      return {
        _id: stream._id,
        filename: stream.filename || stream.name,
        url: stream.cloudinaryUrl,
        hlsUrl: publicId ? cloudinary.url(publicId, {
          resource_type: 'video',
          format: 'm3u8',
          streaming_profile: 'full_hd'
        }) : null,
        thumbnailUrl: publicId ? cloudinary.url(publicId, {
          resource_type: 'video',
          format: 'jpg',
          transformation: [
            { start_offset: '5' },
            { width: 320, height:180, crop: 'fill' }
          ]
        }) : '/api/placeholder/320/180',
        uploadDate: stream.createdAt,
        size: stream.size,
        classTitle: stream.classTitle,
        duration: stream.duration,
        participants: stream.participants,
        classDescription: stream.classDescription
      };
    });
    
    res.json(classVideos);
  } catch (error) {
    console.error('Get videos by class error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Delete stream from Cloudinary
router.delete('/delete-stream/:streamId', async (req, res) => {
  try {
    const { streamId } = req.params;
    const stream = await Stream.getById(streamId);
    
    if (!stream) {
      return res.status(404).json({ success: false, message: 'Stream not found' });
    }
    
    // Delete from Cloudinary if public ID exists
    if (stream.cloudinaryPublicId) {
      await cloudinary.uploader.destroy(stream.cloudinaryPublicId, {
        resource_type: 'video'
      });
    }
    
    // Delete from database
    await Stream.delete(streamId);
    
    res.json({ success: true, message: 'Stream deleted successfully' });
  } catch (error) {
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

// Generate video thumbnail
router.post('/generate-thumbnail', async (req, res) => {
  try {
    const { publicId, timestamp } = req.body;
    
    if (!publicId) {
      return res.status(400).json({ error: 'Public ID required' });
    }
    
    const thumbnailUrl = cloudinary.url(publicId, {
      resource_type: 'video',
      format: 'jpg',
      transformation: [
        { start_offset: timestamp || '5' },
        { width: 640, height: 360, crop: 'fill' },
        { quality: 'auto' }
      ]
    });
    
    res.json({ success: true, thumbnailUrl });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;