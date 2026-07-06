import express from "express";
import multer from "multer";
import Stream from "../models/Stream.js";
import LiveSession from "../models/LiveSession.js";
import Class from "../models/Class.js";
import Enrollment from "../models/Enrollment.js";
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
    
    const upload = await mux.video.uploads.create({
      cors_origin: '*',
      new_asset_settings: {
        playback_policy: ['public'],
        max_resolution_tier: '1080p',
        asset_name: `${classTitle} - ${new Date().toLocaleDateString()}`,
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
      assetName = asset.name;
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

// Save stream endpoint
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
      muxPlaybackId,
      muxUploadId
    } = req.body;
    
    console.log('📝 Saving stream with data:', {
      userId,
      streamName,
      streamClass,
      classTitle,
      muxAssetId,
      muxPlaybackId,
      muxUploadId
    });
    
    if (!userId) {
      return res.status(400).json({ 
        success: false, 
        message: 'userId is required' 
      });
    }
    
    if (!muxAssetId || !muxPlaybackId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Mux asset ID and playback ID are required' 
      });
    }
    
    let existingStream = await Stream.getByMuxAssetId(muxAssetId);
    
    if (existingStream) {
      console.log(`⚠️ Stream already exists for Mux asset ${muxAssetId}, updating...`);
      
      await Stream.update(existingStream._id, {
        muxPlaybackId: muxPlaybackId,
        muxStatus: 'ready',
        classTitle: classTitle || existingStream.classTitle,
        classDescription: classDescription || existingStream.classDescription,
        muxUploadId: muxUploadId || existingStream.muxUploadId,
      });
      
      const updatedStream = await Stream.getById(existingStream._id);
      
      return res.json({
        success: true,
        streamId: existingStream._id,
        playbackId: muxPlaybackId,
        playbackUrl: `https://stream.mux.com/${muxPlaybackId}.m3u8`,
        assetName: classTitle || existingStream.classTitle,
        updated: true
      });
    }
    
    const streamId = await Stream.create({
      userId,
      name: streamName || classTitle || 'Untitled Stream',
      filename: `${streamName || classTitle || 'stream'}.mp4`,
      size: 0,
      streamClass: streamClass || null,
      classTitle: classTitle || streamName || 'Untitled',
      classDescription: classDescription || '',
      participants: participants || 0,
      duration: duration || '0:00',
      muxAssetId: muxAssetId,
      muxPlaybackId: muxPlaybackId,
      muxUploadId: muxUploadId || null,
    });
    
    console.log(`✅ Stream saved to DB: ${streamId}, Mux asset: ${muxAssetId}, Title: ${classTitle}`);
    
    res.json({
      success: true,
      streamId: streamId,
      playbackId: muxPlaybackId,
      playbackUrl: `https://stream.mux.com/${muxPlaybackId}.m3u8`,
      assetName: classTitle,
    });
  } catch (error) {
    console.error('Save stream error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update Mux asset title after upload
router.post('/mux/update-asset-title/:assetId', async (req, res) => {
  try {
    const { assetId } = req.params;
    const { title } = req.body;
    
    if (!title) {
      return res.status(400).json({ success: false, message: 'Title is required' });
    }
    
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

// ===== CHECK VIDEO ACCESS FOR STUDENT =====
router.get('/check-video-access/:classId', async (req, res) => {
  try {
    const { classId } = req.params;
    const userId = req.query.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Get class to check if free
    const classData = await Class.findById(classId);
    if (!classData) {
      return res.status(404).json({
        success: false,
        message: 'Class not found'
      });
    }

    // If class is free, allow access
    if (classData.isFree || classData.price === 0) {
      return res.json({
        success: true,
        hasAccess: true,
        accessType: 'free',
        message: 'Free class - access granted'
      });
    }

    // Check if user has paid enrollment
    const enrollment = await Enrollment.findOne({
      userId: userId,
      classId: classId,
      paymentStatus: 'paid'
    });

    if (enrollment) {
      return res.json({
        success: true,
        hasAccess: true,
        accessType: 'paid',
        message: 'Paid access granted'
      });
    }

    // No access
    return res.json({
      success: true,
      hasAccess: false,
      accessType: 'none',
      message: 'Payment required to access this content',
      price: classData.price,
      currency: classData.currency || 'NGN'
    });

  } catch (error) {
    console.error('Check video access error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check access'
    });
  }
});

// ===== GET VIDEOS BY CLASS WITH ACCESS CONTROL =====
router.get('/by-class/:classId', async (req, res) => {
  try {
    const { classId } = req.params;
    const userId = req.query.userId;

    console.log(`🔍 Fetching videos for class: ${classId}, user: ${userId}`);

    // Get class to check if free
    const classData = await Class.findById(classId);
    
    // Check if user has access
    let hasAccess = false;
    let accessType = 'none';

    if (classData) {
      if (classData.isFree || classData.price === 0) {
        hasAccess = true;
        accessType = 'free';
      } else if (userId) {
        const enrollment = await Enrollment.findOne({
          userId: userId,
          classId: classId,
          paymentStatus: 'paid'
        });
        if (enrollment) {
          hasAccess = true;
          accessType = 'paid';
        }
      }
    }

    // Get videos from database
    let classVideos = await Stream.getClassVideos(classId);
    
    // If no videos, try to fetch from Mux
    if (classVideos.length === 0) {
      console.log('⚠️ No videos in database, checking Mux directly...');
      
      try {
        const assets = await mux.video.assets.list({
          limit: 100,
          status: 'ready'
        });
        
        for (const asset of assets) {
          let passthrough = {};
          try {
            passthrough = JSON.parse(asset.passthrough || '{}');
          } catch (e) {}
          
          if (passthrough.classId === classId && asset.playback_ids?.[0]?.id) {
            const existing = await Stream.getByMuxAssetId(asset.id);
            if (!existing) {
              await Stream.create({
                userId: passthrough.instructorId || 'unknown',
                name: asset.name || passthrough.classTitle || 'Untitled',
                filename: `${asset.name || 'stream'}.mp4`,
                size: 0,
                streamClass: classId,
                classTitle: passthrough.classTitle || asset.name || 'Untitled',
                classDescription: passthrough.classDescription || '',
                participants: 0,
                duration: asset.duration ? `${Math.floor(asset.duration / 60)}:${Math.floor(asset.duration % 60).toString().padStart(2, '0')}` : '0:00',
                muxAssetId: asset.id,
                muxPlaybackId: asset.playback_ids[0].id,
                muxUploadId: passthrough.uploadId || null,
              });
            }
          }
        }
        classVideos = await Stream.getClassVideos(classId);
      } catch (muxError) {
        console.error('Mux fetch error:', muxError);
      }
    }

    // If user doesn't have access, return videos without playback URLs
    const responseVideos = classVideos.map(video => {
      const videoObj = video.toObject ? video.toObject() : video;
      
      if (!hasAccess) {
        // Return video info but mask playback
        return {
          ...videoObj,
          muxPlaybackId: null,
          playbackUrl: null,
          locked: true,
          requiresPayment: true,
          price: classData?.price || 0,
          currency: classData?.currency || 'NGN'
        };
      }
      
      // Return full video with playback
      return {
        ...videoObj,
        locked: false,
        playbackUrl: videoObj.muxPlaybackId ? 
          `https://stream.mux.com/${videoObj.muxPlaybackId}.m3u8` : null
      };
    });

    res.json({
      success: true,
      videos: responseVideos,
      hasAccess: hasAccess,
      accessType: accessType,
      classInfo: classData ? {
        title: classData.title,
        isFree: classData.isFree,
        price: classData.price,
        currency: classData.currency || 'NGN'
      } : null
    });

  } catch (error) {
    console.error('Get videos by class error:', error);
    res.status(500).json({ 
      message: 'Internal server error', 
      error: error.message 
    });
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
    
    if (stream.muxAssetId) {
      try {
        await mux.video.assets.del(stream.muxAssetId);
        console.log(`Deleted Mux asset: ${stream.muxAssetId} - ${stream.classTitle}`);
      } catch (muxError) {
        console.error('Mux delete error:', muxError);
      }
    }
    
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

// ===== GET SINGLE MUX VIDEO BY ASSET ID =====
router.get('/mux/video/:assetId', async (req, res) => {
  try {
    const { assetId } = req.params;
    
    const asset = await mux.video.assets.retrieve(assetId);
    
    if (!asset) {
      return res.status(404).json({ success: false, message: 'Video not found' });
    }
    
    let passthrough = {};
    try {
      passthrough = JSON.parse(asset.passthrough || '{}');
    } catch (e) {}
    
    res.json({
      success: true,
      video: {
        assetId: asset.id,
        title: asset.name || passthrough.classTitle || 'Untitled',
        description: passthrough.classDescription || '',
        playbackId: asset.playback_ids?.[0]?.id,
        playbackUrl: asset.playback_ids?.[0]?.id ? 
          `https://stream.mux.com/${asset.playback_ids[0].id}.m3u8` : null,
        thumbnailUrl: asset.playback_ids?.[0]?.id ?
          `https://image.mux.com/${asset.playback_ids[0].id}/thumbnail.jpg?time=5` : null,
        duration: asset.duration,
        createdAt: asset.created_at,
        status: asset.status,
      },
    });
    
  } catch (error) {
    console.error('Get Mux video error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ===== GET MUX ASSETS BY CLASS ID =====
router.get('/mux/class-videos/:classId', async (req, res) => {
  try {
    const { classId } = req.params;
    
    let allAssets = [];
    let page = 1;
    let hasMore = true;
    
    while (hasMore) {
      const assets = await mux.video.assets.list({
        limit: 50,
        page: page,
      });
      
      allAssets = [...allAssets, ...assets];
      
      hasMore = assets.length === 50;
      page++;
    }
    
    const classVideos = allAssets.filter(asset => {
      if (!asset.passthrough) return false;
      
      try {
        const passthrough = JSON.parse(asset.passthrough);
        return passthrough.classId === classId;
      } catch (e) {
        return false;
      }
    }).map(asset => {
      let passthrough = {};
      try {
        passthrough = JSON.parse(asset.passthrough || '{}');
      } catch (e) {}
      
      return {
        assetId: asset.id,
        title: asset.name || passthrough.classTitle || 'Untitled',
        description: passthrough.classDescription || '',
        playbackId: asset.playback_ids?.[0]?.id,
        playbackUrl: asset.playback_ids?.[0]?.id ? 
          `https://stream.mux.com/${asset.playback_ids[0].id}.m3u8` : null,
        thumbnailUrl: asset.playback_ids?.[0]?.id ?
          `https://image.mux.com/${asset.playback_ids[0].id}/thumbnail.jpg?time=5` : null,
        duration: asset.duration,
        createdAt: asset.created_at,
        status: asset.status,
        passthrough: passthrough,
      };
    });
    
    classVideos.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    res.json({
      success: true,
      videos: classVideos,
      count: classVideos.length,
    });
    
  } catch (error) {
    console.error('Get Mux class videos error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Debug endpoint to check class videos
router.get('/debug/class-videos/:classId', async (req, res) => {
  try {
    const { classId } = req.params;
    
    const dbVideos = await Stream.getClassVideos(classId);
    
    let muxVideos = [];
    try {
      const assets = await mux.video.assets.list({
        limit: 100,
        status: 'ready'
      });
      
      for (const asset of assets) {
        let passthrough = {};
        try {
          passthrough = JSON.parse(asset.passthrough || '{}');
        } catch (e) {}
        
        if (passthrough.classId === classId) {
          muxVideos.push({
            assetId: asset.id,
            name: asset.name,
            title: passthrough.classTitle || asset.name,
            playbackId: asset.playback_ids?.[0]?.id,
            status: asset.status,
            createdAt: asset.created_at,
            passthrough: passthrough
          });
        }
      }
    } catch (e) {
      console.error('Mux fetch error:', e);
    }
    
    res.json({
      success: true,
      classId,
      database: {
        count: dbVideos.length,
        videos: dbVideos
      },
      mux: {
        count: muxVideos.length,
        videos: muxVideos
      },
      synced: dbVideos.length === muxVideos.length,
      missing: muxVideos.filter(m => !dbVideos.some(d => d.muxAssetId === m.assetId))
    });
  } catch (error) {
    console.error('Debug class videos error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Mux asset status endpoint
router.get('/mux/asset-status/:playbackId', async (req, res) => {
    try {
        const { playbackId } = req.params;
        
        const assets = await mux.video.assets.list({
            limit: 100,
        });
        
        let foundAsset = null;
        for (const asset of assets) {
            if (asset.playback_ids && asset.playback_ids.some(p => p.id === playbackId)) {
                foundAsset = asset;
                break;
            }
        }
        
        if (!foundAsset) {
            return res.json({
                success: true,
                ready: false,
                status: 'not_found',
                message: 'Asset not found'
            });
        }
        
        const isReady = foundAsset.status === 'ready';
        const isPreparing = foundAsset.status === 'preparing' || foundAsset.status === 'uploading';
        
        res.json({
            success: true,
            ready: isReady,
            status: foundAsset.status,
            assetId: foundAsset.id,
            name: foundAsset.name,
            duration: foundAsset.duration,
            message: isReady ? 'Video is ready' : isPreparing ? 'Video is still processing' : 'Video has an error'
        });
        
    } catch (error) {
        console.error('Get asset status error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

export default router;