// backend/services/emailService.js
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

class EmailService {
    constructor() {
        this.transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });
    }

    async sendEmail(to, subject, html, text = '') {
        try {
            const mailOptions = {
                from: process.env.EMAIL_FROM || `"FISSK Online Academy" <${process.env.EMAIL_USER}>`,
                to: to,
                subject: subject,
                text: text || html.replace(/<[^>]*>/g, ''),
                html: html
            };

            const info = await this.transporter.sendMail(mailOptions);
            console.log(`✅ Email sent to ${to}: ${info.messageId}`);
            return { success: true, messageId: info.messageId };
        } catch (error) {
            console.error('❌ Email send error:', error);
            return { success: false, error: error.message };
        }
    }

    // ===== STUDENT WELCOME EMAIL =====
    async sendStudentWelcomeEmail(studentEmail, studentName) {
        const subject = "🎓 Welcome to FISSK Online Academy!";
        
        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; background: #f8f9fa; }
                    .header { background: linear-gradient(135deg, #6C3CE1, #8B5FBF); color: white; padding: 30px; text-align: center; border-radius: 12px 12px 0 0; }
                    .content { background: white; padding: 30px; border-radius: 0 0 12px 12px; }
                    .features { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin: 20px 0; }
                    .feature { background: #f8f9fa; padding: 15px; border-radius: 8px; text-align: center; }
                    .button { display: inline-block; background: #FF6B8B; color: white; padding: 14px 30px; text-decoration: none; border-radius: 50px; font-weight: 600; }
                    .footer { text-align: center; padding: 20px; color: #666; font-size: 0.9rem; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h2>🎓 FISSK Online Academy</h2>
                        <p style="opacity:0.9;">Welcome to the Future of Learning</p>
                    </div>
                    <div class="content">
                        <h2>Welcome to FISSK, ${studentName}! 🎉</h2>
                        <p>You've joined a community of <strong>2,500+ students</strong> learning and growing together.</p>
                        
                        <div class="features">
                            <div class="feature">🎓 Free Live Classes</div>
                            <div class="feature">📹 Recorded Sessions</div>
                            <div class="feature">💬 Student Community</div>
                            <div class="feature">📊 Track Progress</div>
                        </div>

                        <p style="text-align:center; margin: 25px 0;">
                            <a href="${process.env.FRONTEND_URL || 'https://fissk-online-academy.onrender.com'}/classes.html" class="button">
                                🚀 Browse Courses
                            </a>
                        </p>

                        <p style="font-size: 0.9rem; color: #666; border-top: 1px solid #eee; padding-top: 20px;">
                            💡 <strong>Did you know?</strong> All live classes are FREE to attend.<br>
                            You only pay for courses you want to access recordings for.
                        </p>
                    </div>
                    <div class="footer">
                        <p>FISSK Online Academy - Empowering students with knowledge</p>
                        <p>📍 Warri, Nigeria | 📧 hello@fissk.com</p>
                    </div>
                </div>
            </body>
            </html>
        `;

        return this.sendEmail(studentEmail, subject, html);
    }

    // ===== INSTRUCTOR WELCOME EMAIL =====
    async sendInstructorWelcomeEmail(instructorEmail, instructorName) {
        const subject = "👨‍🏫 Welcome to FISSK Online Academy - Instructor Portal!";
        
        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; background: #f8f9fa; }
                    .header { background: linear-gradient(135deg, #6C3CE1, #8B5FBF); color: white; padding: 30px; text-align: center; border-radius: 12px 12px 0 0; }
                    .content { background: white; padding: 30px; border-radius: 0 0 12px 12px; }
                    .button { display: inline-block; background: #6C3CE1; color: white; padding: 14px 30px; text-decoration: none; border-radius: 50px; font-weight: 600; }
                    .footer { text-align: center; padding: 20px; color: #666; font-size: 0.9rem; }
                    .step { background: #f8f9fa; padding: 12px 16px; border-radius: 8px; margin: 10px 0; border-left: 4px solid #6C3CE1; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h2>🎓 FISSK Online Academy</h2>
                        <p style="opacity:0.9;">Welcome to the Instructor Portal</p>
                    </div>
                    <div class="content">
                        <h2>Welcome, ${instructorName}! 👨‍🏫</h2>
                        <p>We're excited to have you as an instructor on FISSK Online Academy.</p>

                        <h3>Getting Started as an Instructor</h3>
                        <div class="step">
                            <strong>1. Create Your First Class</strong>
                            <p style="margin: 4px 0 0 0; color: #666; font-size: 0.9rem;">Set up your course with title, description, and category.</p>
                        </div>
                        <div class="step">
                            <strong>2. Schedule Live Sessions</strong>
                            <p style="margin: 4px 0 0 0; color: #666; font-size: 0.9rem;">Schedule your live classes and share meeting links with students.</p>
                        </div>
                        <div class="step">
                            <strong>3. Upload Recordings</strong>
                            <p style="margin: 4px 0 0 0; color: #666; font-size: 0.9rem;">Share recorded sessions for students to access anytime.</p>
                        </div>
                        <div class="step">
                            <strong>4. Set Your Price</strong>
                            <p style="margin: 4px 0 0 0; color: #666; font-size: 0.9rem;">Decide how much to charge for course access and earn from your expertise.</p>
                        </div>

                        <p style="text-align:center; margin: 25px 0;">
                            <a href="${process.env.FRONTEND_URL || 'https://fissk-online-academy.onrender.com'}/instructor-dashboard.html" class="button">
                                📊 Go to Dashboard
                            </a>
                        </p>

                        <div style="background: #fff3e0; padding: 16px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #FF9800;">
                            <p style="margin: 0; font-size: 0.9rem;">
                                💰 <strong>Earn from your expertise!</strong> 
                                You get <strong>70%</strong> of every course sale.
                            </p>
                        </div>
                    </div>
                    <div class="footer">
                        <p>FISSK Online Academy - Empowering students with knowledge</p>
                        <p>📍 Warri, Nigeria | 📧 hello@fissk.com</p>
                    </div>
                </div>
            </body>
            </html>
        `;

        return this.sendEmail(instructorEmail, subject, html);
    }
}

export default new EmailService();