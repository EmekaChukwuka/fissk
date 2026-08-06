import express from 'express';
import CertificateService from '../services/certificateService.js';
import { auth } from '../middleware/auth.js';

const certificateRouter = express.Router();

// ============================================================
// CERTIFICATE ENDPOINTS
// ============================================================

// Check certificate eligibility
certificateRouter.post('/check-eligibility', auth, async (req, res) => {
  try {
    const { classId } = req.body;
    const userId = req.user.id;
    
    const eligibility = await CertificateService.checkEligibility(userId, classId);
    res.json({ success: true, ...eligibility });
  } catch (error) {
    console.error('Check eligibility error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Generate certificate
certificateRouter.post('/generate', auth, async (req, res) => {
  try {
    const { classId, enrollmentId } = req.body;
    const userId = req.user.id;
    
    const certificate = await CertificateService.generateCertificate(
      userId, 
      classId, 
      { _id: enrollmentId }
    );
    
    res.json({
      success: true,
      certificate,
      message: 'Certificate generated successfully!'
    });
  } catch (error) {
    console.error('Generate certificate error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Failed to generate certificate' 
    });
  }
});

// Get user's certificates
certificateRouter.get('/user', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const certificates = await CertificateService.getUserCertificates(userId);
    res.json({ success: true, certificates });
  } catch (error) {
    console.error('Get user certificates error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get certificate by ID
certificateRouter.get('/:id', auth, async (req, res) => {
  try {
    const certificate = await CertificateService.getCertificate(req.params.id);
    
    if (!certificate) {
      return res.status(404).json({ success: false, message: 'Certificate not found' });
    }
    
    // Check if user owns this certificate
    if (certificate.userId._id.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    
    res.json({ success: true, certificate });
  } catch (error) {
    console.error('Get certificate error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Verify certificate (public endpoint)
certificateRouter.get('/verify/:certificateNumber', async (req, res) => {
  try {
    const result = await CertificateService.verifyCertificate(req.params.certificateNumber);
    res.json(result);
  } catch (error) {
    console.error('Verify certificate error:', error);
    res.status(500).json({ 
      valid: false, 
      message: 'Verification failed' 
    });
  }
});

// Download certificate
certificateRouter.get('/:id/download', auth, async (req, res) => {
  try {
    const certificate = await CertificateService.getCertificate(req.params.id);
    
    if (!certificate) {
      return res.status(404).json({ success: false, message: 'Certificate not found' });
    }
    
    if (certificate.userId._id.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    
    // Mark as downloaded
    await Certificate.findByIdAndUpdate(req.params.id, {
      isDownloaded: true,
      downloadedAt: new Date()
    });
    
    // In production, return the actual PDF file
    // For now, return the HTML view
    const html = CertificateService.generateCertificateHTML(certificate);
    res.send(html);
    
  } catch (error) {
    console.error('Download certificate error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

export default certificateRouter;