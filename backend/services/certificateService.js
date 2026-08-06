import Certificate from '../models/Certificate.js';
import Enrollment from '../models/Enrollment.js';
import Class from '../models/Class.js';
import User from '../models/User.js';
import pdfMake from 'pdfmake';
import { v4 as uuidv4 } from 'uuid';

// Certificate generation settings
const CERTIFICATE_CONFIG = {
  primaryColor: '#8B5FBF',
  secondaryColor: '#6C63FF',
  textColor: '#1A1A2E'
};

class CertificateService {
  /**
   * Check if student is eligible for certificate
   */
  static async checkEligibility(userId, classId) {
    const enrollment = await Enrollment.findOne({ userId, classId });
    
    if (!enrollment) {
      return { eligible: false, reason: 'Not enrolled in this class' };
    }
    
    if (!enrollment.completed) {
      return { eligible: false, reason: 'Course not completed yet' };
    }
    
    if (enrollment.progress < 100) {
      return { eligible: false, reason: 'Course progress not at 100%' };
    }
    
    // Check if certificate already exists
    const existing = await Certificate.findOne({ userId, classId });
    if (existing) {
      return { eligible: true, exists: true, certificate: existing };
    }
    
    // Check if all quizzes passed (if any)
    const Quiz = (await import('../models/Quiz.js')).default;
    const QuizAttempt = (await import('../models/QuizAttempt.js')).default;
    
    const quizzes = await Quiz.find({ classId, status: 'published' });
    if (quizzes.length > 0) {
      const quizIds = quizzes.map(q => q._id);
      const attempts = await QuizAttempt.find({
        quizId: { $in: quizIds },
        userId,
        passed: true
      });
      
      const passRate = attempts.length / quizzes.length;
      if (passRate < 0.7) {
        return { 
          eligible: false, 
          reason: `Only ${Math.round(passRate * 100)}% of quizzes passed (minimum 70% required)` 
        };
      }
    }
    
    return { eligible: true };
  }

  /**
   * Generate certificate for a student
   */
  static async generateCertificate(userId, classId, enrollment) {
    // Check eligibility
    const eligibility = await this.checkEligibility(userId, classId);
    if (!eligibility.eligible) {
      throw new Error(eligibility.reason);
    }
    
    if (eligibility.exists) {
      return eligibility.certificate;
    }
    
    // Get user and class data
    const user = await User.findById(userId);
    const classData = await Class.findById(classId);
    
    if (!user || !classData) {
      throw new Error('User or class not found');
    }
    
    // Calculate grade based on score
    let grade = 'Pass';
    let score = 0;
    
    // Get quiz scores
    const Quiz = (await import('../models/Quiz.js')).default;
    const QuizAttempt = (await import('../models/QuizAttempt.js')).default;
    
    const quizzes = await Quiz.find({ classId, status: 'published' });
    if (quizzes.length > 0) {
      const quizIds = quizzes.map(q => q._id);
      const attempts = await QuizAttempt.find({
        quizId: { $in: quizIds },
        userId,
        status: { $in: ['completed', 'graded'] }
      });
      
      if (attempts.length > 0) {
        const scores = attempts.map(a => a.score || 0);
        score = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
        
        if (score >= 85) grade = 'Distinction';
        else if (score >= 70) grade = 'Merit';
        else grade = 'Pass';
      }
    }
    
    // Create certificate
    const certificate = new Certificate({
      userId,
      classId,
      enrollmentId: enrollment._id,
      studentName: `${user.firstName} ${user.lastName}`.trim(),
      studentEmail: user.email,
      courseTitle: classData.title,
      courseLevel: classData.level || 'Beginner',
      grade,
      score,
      issueDate: new Date()
    });
    
    await certificate.save();
    
    // Generate PDF
    await this.generatePDF(certificate);
    
    return certificate;
  }

  /**
   * Generate PDF certificate using pdfmake
   */
  static async generatePDF(certificate) {
    try {
      const docDefinition = this.createPDFDefinition(certificate);
      
      // Generate PDF
      const pdfDoc = await new Promise((resolve, reject) => {
        try {
          const pdf = pdfMake.createPdf(docDefinition);
          pdf.getBuffer((buffer) => {
            resolve(buffer);
          });
        } catch (error) {
          reject(error);
        }
      });
      
      // Store PDF data
      certificate.pdfData = Buffer.from(pdfDoc);
      certificate.certificateUrl = `/api/certificates/${certificate.certificateNumber}`;
      await certificate.save();
      
      return certificate;
    } catch (error) {
      console.error('Certificate generation error:', error);
      // Even if PDF generation fails, we still have the certificate record
      return certificate;
    }
  }

  /**
   * Create PDF definition for pdfmake
   */
  static createPDFDefinition(certificate) {
    const issueDate = new Date(certificate.issueDate).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const primaryColor = CERTIFICATE_CONFIG.primaryColor;
    const textColor = CERTIFICATE_CONFIG.textColor;

    return {
      pageSize: 'A4',
      pageOrientation: 'landscape',
      pageMargins: [40, 40, 40, 40],
      background: {
        canvas: [
          { type: 'rect', x: 0, y: 0, w: 842, h: 595, color: '#ffffff' }
        ]
      },
      content: [
        // Border decoration
        {
          canvas: [
            { type: 'rect', x: 10, y: 10, w: 822, h: 575, r: 8, color: primaryColor, lineWidth: 8, type: 'rect' }
          ]
        },
        // Inner border
        {
          canvas: [
            { type: 'rect', x: 25, y: 25, w: 792, h: 545, r: 4, color: primaryColor, lineWidth: 1.5, opacity: 0.3 }
          ]
        },
        // Logo/Badge
        {
          text: '🎓',
          alignment: 'center',
          fontSize: 40,
          margin: [0, 20, 0, 5]
        },
        {
          text: 'FISSK Academy',
          alignment: 'center',
          fontSize: 28,
          bold: true,
          color: primaryColor,
          margin: [0, 0, 0, 4]
        },
        {
          text: 'Certificate of Completion',
          alignment: 'center',
          fontSize: 18,
          color: '#6B7280',
          margin: [0, 0, 0, 16]
        },
        {
          text: 'This certificate is proudly presented to',
          alignment: 'center',
          fontSize: 14,
          color: '#6B7280',
          margin: [0, 10, 0, 8]
        },
        // Student Name
        {
          text: certificate.studentName,
          alignment: 'center',
          fontSize: 34,
          bold: true,
          color: primaryColor,
          margin: [0, 8, 0, 12]
        },
        {
          text: 'for successfully completing the course',
          alignment: 'center',
          fontSize: 14,
          color: '#6B7280',
          margin: [0, 0, 0, 8]
        },
        // Course Name
        {
          text: `"${certificate.courseTitle}"`,
          alignment: 'center',
          fontSize: 22,
          bold: true,
          color: textColor,
          margin: [0, 4, 0, 12]
        },
        // Grade Section
        {
          table: {
            widths: ['auto'],
            body: [
              [
                {
                  text: [
                    { text: 'Grade: ', color: '#6B7280', fontSize: 12 },
                    { text: certificate.grade, color: primaryColor, fontSize: 16, bold: true },
                    certificate.score > 0 ? { text: `  •  ${certificate.score}%`, color: '#6B7280', fontSize: 12 } : {}
                  ],
                  alignment: 'center',
                  margin: [0, 4, 0, 4],
                  fillColor: '#f8f4ff',
                  padding: [16, 8, 16, 8]
                }
              ]
            ]
          },
          layout: 'noBorders',
          margin: [0, 0, 0, 12]
        },
        {
          text: `${certificate.courseLevel || 'Beginner'} Level • Completed on ${issueDate}`,
          alignment: 'center',
          fontSize: 12,
          color: '#6B7280',
          margin: [0, 0, 0, 20]
        },
        // Signatures
        {
          columns: [
            {
              stack: [
                { text: '_________________________', alignment: 'center', fontSize: 14 },
                { text: 'FISSK Academy', alignment: 'center', fontSize: 12, bold: true },
                { text: 'Authorized Signature', alignment: 'center', fontSize: 10, color: '#6B7280' }
              ],
              width: '50%'
            },
            {
              stack: [
                { text: '_________________________', alignment: 'center', fontSize: 14 },
                { text: issueDate, alignment: 'center', fontSize: 12, bold: true },
                { text: 'Date Issued', alignment: 'center', fontSize: 10, color: '#6B7280' }
              ],
              width: '50%'
            }
          ],
          margin: [0, 10, 0, 0]
        },
        // Certificate Number
        {
          text: `Certificate ID: ${certificate.certificateNumber}`,
          alignment: 'center',
          fontSize: 8,
          color: '#9CA3AF',
          margin: [0, 30, 0, 0]
        }
      ]
    };
  }

  /**
   * Get certificate by ID
   */
  static async getCertificate(certificateId) {
    return await Certificate.findById(certificateId)
      .populate('userId', 'firstName lastName email')
      .populate('classId', 'title level')
      .lean();
  }

  /**
   * Get user's certificates
   */
  static async getUserCertificates(userId) {
    return await Certificate.find({ userId })
      .populate('classId', 'title level')
      .sort({ issueDate: -1 })
      .lean();
  }

  /**
   * Verify certificate
   */
  static async verifyCertificate(certificateNumber) {
    const certificate = await Certificate.findOne({ certificateNumber })
      .populate('userId', 'firstName lastName')
      .populate('classId', 'title');
    
    if (!certificate) {
      return { valid: false, message: 'Certificate not found' };
    }
    
    if (!certificate.isVerified) {
      return { valid: false, message: 'Certificate has been revoked' };
    }
    
    return {
      valid: true,
      certificate: {
        number: certificate.certificateNumber,
        student: certificate.studentName,
        course: certificate.courseTitle,
        grade: certificate.grade,
        issueDate: certificate.issueDate,
        expiryDate: certificate.expiryDate
      }
    };
  }
}

export default CertificateService;