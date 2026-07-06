// backend/services/emailService.js
import dotenv from 'dotenv';

dotenv.config();

class EmailService {
    constructor() {
        this.apiKey = process.env.BREVO_API_KEY;
        this.baseUrl = 'https://api.brevo.com/v3';
        
        if (!this.apiKey) {
            console.error('❌ BREVO_API_KEY is not set in environment variables');
        } else {
            console.log('✅ Brevo API key found');
        }
    }

    async sendEmail(to, subject, html, text = '') {
        try {
            const response = await fetch(`${this.baseUrl}/smtp/email`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'api-key': this.apiKey
                },
                body: JSON.stringify({
                    sender: {
                        email: process.env.EMAIL_FROM,
                        name: 'FISSK Online Academy'
                    },
                    to: [{ email: to }],
                    subject: subject,
                    htmlContent: html,
                    textContent: text || html.replace(/<[^>]*>/g, '')
                })
            });

            const data = await response.json();

            if (response.ok) {
                console.log(`✅ Email sent via Brevo API to ${to}: ${data.messageId}`);
                return { success: true, messageId: data.messageId };
            } else {
                console.error('❌ Brevo API error:', data);
                return { success: false, error: data.message || 'Unknown API error' };
            }
        } catch (error) {
            console.error('❌ Brevo API send error:', error.message);
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

    // ===== PAYMENT RECEIPT EMAIL =====
    async sendPaymentReceipt(studentEmail, studentName, data) {
        const subject = `🎉 Payment Confirmation - ${data.courseName}`;
        
        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; background: #f8f9fa; }
                    .header { background: linear-gradient(135deg, #6C3CE1, #8B5FBF); color: white; padding: 30px; text-align: center; border-radius: 12px 12px 0 0; }
                    .content { background: white; padding: 30px; border-radius: 0 0 12px 12px; }
                    .details { background: #f0f0ff; padding: 20px; border-radius: 8px; margin: 20px 0; }
                    .button { display: inline-block; background: #FF6B8B; color: white; padding: 14px 30px; text-decoration: none; border-radius: 50px; font-weight: 600; }
                    .footer { text-align: center; padding: 20px; color: #666; font-size: 0.9rem; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h2>🎓 FISSK Online Academy</h2>
                        <p style="opacity:0.9;">Payment Confirmation</p>
                    </div>
                    <div class="content">
                        <h2>Thank you for your purchase, ${studentName}! 🎉</h2>
                        <p>Your payment for <strong>${data.courseName}</strong> has been confirmed.</p>
                        
                        <div class="details">
                            <p><strong>💰 Amount:</strong> ₦${data.amount.toLocaleString()}</p>
                            <p><strong>📝 Reference:</strong> ${data.reference}</p>
                            <p><strong>📅 Date:</strong> ${new Date(data.paidAt).toLocaleDateString()}</p>
                            <p><strong>👨‍🏫 Instructor:</strong> ${data.instructorName}</p>
                        </div>

                        <p style="text-align:center; margin: 25px 0;">
                            <a href="${process.env.FRONTEND_URL}/class.html?id=${data.classId}" class="button">
                                📚 Access Your Course
                            </a>
                        </p>

                        <p style="font-size: 0.9rem; color: #666;">
                            You now have full access to:
                            <br>✅ Recorded sessions
                            <br>✅ Course materials
                            <br>✅ Community forum
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

    // ===== INSTRUCTOR SALE NOTIFICATION =====
    async sendInstructorSaleEmail(instructorEmail, instructorName, saleData) {
        const subject = `📚 New Course Sale - ${saleData.courseName}`;
        
        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; background: #f8f9fa; }
                    .header { background: linear-gradient(135deg, #6C3CE1, #8B5FBF); color: white; padding: 30px; text-align: center; border-radius: 12px 12px 0 0; }
                    .content { background: white; padding: 30px; border-radius: 0 0 12px 12px; }
                    .details { background: #f0f0ff; padding: 20px; border-radius: 8px; margin: 20px 0; }
                    .button { display: inline-block; background: #6C3CE1; color: white; padding: 14px 30px; text-decoration: none; border-radius: 50px; font-weight: 600; }
                    .footer { text-align: center; padding: 20px; color: #666; font-size: 0.9rem; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h2>🎓 FISSK Online Academy</h2>
                        <p style="opacity:0.9;">New Course Sale</p>
                    </div>
                    <div class="content">
                        <h2>Congratulations, ${instructorName}! 🎉</h2>
                        <p>A student has purchased your course:</p>
                        <h3 style="color: #6C3CE1;">${saleData.courseName}</h3>
                        
                        <div class="details">
                            <p><strong>💰 Amount:</strong> ₦${saleData.amount.toLocaleString()}</p>
                            <p><strong>👤 Student:</strong> ${saleData.studentName}</p>
                            <p><strong>📧 Email:</strong> ${saleData.studentEmail}</p>
                            <p><strong>📅 Date:</strong> ${new Date(saleData.paidAt).toLocaleDateString()}</p>
                            <p><strong>💵 Your Earnings:</strong> ₦${saleData.instructorEarning.toLocaleString()} (70%)</p>
                            <p><strong>💰 Total Earnings:</strong> ₦${saleData.totalEarnings.toLocaleString()}</p>
                        </div>

                        <p style="text-align:center; margin: 25px 0;">
                            <a href="${process.env.FRONTEND_URL}/instructor-dashboard.html" class="button">
                                📊 View Dashboard
                            </a>
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

        return this.sendEmail(instructorEmail, subject, html);
    }

    // ===== WITHDRAWAL REQUEST EMAIL =====
    async sendWithdrawalRequestEmail(instructorEmail, instructorName, data) {
        const subject = `💰 Withdrawal Request Submitted - ${data.reference}`;
        
        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; background: #f8f9fa; }
                    .header { background: linear-gradient(135deg, #6C3CE1, #8B5FBF); color: white; padding: 30px; text-align: center; border-radius: 12px 12px 0 0; }
                    .content { background: white; padding: 30px; border-radius: 0 0 12px 12px; }
                    .details { background: #f0f0ff; padding: 20px; border-radius: 8px; margin: 20px 0; }
                    .footer { text-align: center; padding: 20px; color: #666; font-size: 0.9rem; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h2>💰 FISSK Online Academy</h2>
                        <p style="opacity:0.9;">Withdrawal Request</p>
                    </div>
                    <div class="content">
                        <h2>Hello ${instructorName}!</h2>
                        <p>Your withdrawal request has been submitted and is being processed.</p>
                        
                        <div class="details">
                            <p><strong>💵 Amount:</strong> ₦${data.amount.toLocaleString()}</p>
                            <p><strong>📝 Reference:</strong> ${data.reference}</p>
                            <p><strong>🏦 Bank:</strong> ${data.bankDetails.bankName}</p>
                            <p><strong>🔢 Account:</strong> ${data.bankDetails.accountNumber}</p>
                            <p><strong>📅 Requested:</strong> ${new Date().toLocaleDateString()}</p>
                        </div>

                        <p style="font-size: 0.9rem; color: #666;">
                            You'll receive a confirmation email once the transfer is completed.
                            <br>This usually takes 1-3 business days.
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

        return this.sendEmail(instructorEmail, subject, html);
    }

    // ===== WITHDRAWAL SUCCESS EMAIL =====
    async sendWithdrawalSuccessEmail(instructorEmail, instructorName, data) {
        const subject = `✅ Withdrawal Completed - ${data.reference}`;
        
        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; background: #f8f9fa; }
                    .header { background: linear-gradient(135deg, #10B981, #059669); color: white; padding: 30px; text-align: center; border-radius: 12px 12px 0 0; }
                    .content { background: white; padding: 30px; border-radius: 0 0 12px 12px; }
                    .details { background: #f0f0ff; padding: 20px; border-radius: 8px; margin: 20px 0; }
                    .footer { text-align: center; padding: 20px; color: #666; font-size: 0.9rem; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h2>✅ FISSK Online Academy</h2>
                        <p style="opacity:0.9;">Withdrawal Completed</p>
                    </div>
                    <div class="content">
                        <h2>Hello ${instructorName}!</h2>
                        <p>Your withdrawal has been successfully processed and sent to your bank account.</p>
                        
                        <div class="details">
                            <p><strong>💵 Amount:</strong> ₦${data.amount.toLocaleString()}</p>
                            <p><strong>📝 Reference:</strong> ${data.reference}</p>
                            <p><strong>🏦 Bank:</strong> ${data.bankDetails.bankName}</p>
                            <p><strong>🔢 Account:</strong> ${data.bankDetails.accountNumber}</p>
                            <p><strong>📅 Completed:</strong> ${new Date(data.completedAt).toLocaleDateString()}</p>
                        </div>

                        <p style="font-size: 0.9rem; color: #666;">
                            Funds should reflect in your account within 1-3 business days.
                            <br>Contact us at hello@fissk.com if you have any questions.
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

        return this.sendEmail(instructorEmail, subject, html);
    }

    // ===== CLASS REMINDER EMAIL =====
    async sendClassReminder(studentEmail, studentName, classData, sessionData) {
        const subject = `🔴 Reminder: ${classData.title} Live Class Starting Soon!`;
        
        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; background: #f8f9fa; }
                    .header { background: linear-gradient(135deg, #6C3CE1, #8B5FBF); color: white; padding: 30px; text-align: center; border-radius: 12px 12px 0 0; }
                    .content { background: white; padding: 30px; border-radius: 0 0 12px 12px; }
                    .class-details { background: #f0f0ff; padding: 20px; border-radius: 8px; margin: 20px 0; }
                    .button { display: inline-block; background: #FF6B8B; color: white; padding: 14px 30px; text-decoration: none; border-radius: 50px; font-weight: 600; }
                    .footer { text-align: center; padding: 20px; color: #666; font-size: 0.9rem; }
                    .live-badge { background: #FF4444; color: white; padding: 4px 12px; border-radius: 20px; font-size: 0.8rem; display: inline-block; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h2>🎓 FISSK Online Academy</h2>
                        <p style="opacity:0.9;">Live Class Reminder</p>
                    </div>
                    <div class="content">
                        <h2>Hello ${studentName}! 👋</h2>
                        <p>Your <strong>${classData.title}</strong> live class is starting soon!</p>
                        
                        <div class="class-details">
                            <p><strong>📚 Class:</strong> ${classData.title}</p>
                            <p><strong>📅 Date:</strong> ${new Date(sessionData.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                            <p><strong>⏰ Time:</strong> ${sessionData.time || 'TBD'}</p>
                            <p><strong>⏱️ Duration:</strong> ${sessionData.duration || '1 hour'}</p>
                            <p><strong>👨‍🏫 Instructor:</strong> ${classData.instructor?.name || 'Instructor'}</p>
                            <p style="margin-top:10px;"><span class="live-badge">🔴 LIVE</span></p>
                        </div>

                        <p style="text-align:center; margin: 25px 0;">
                            <a href="${process.env.FRONTEND_URL}/newlivestream.html?session=${sessionData._id}" class="button">
                                🎥 Join Live Class Now
                            </a>
                        </p>

                        <p style="font-size:0.9rem; color:#666;">
                            💡 <strong>Tip:</strong> Join 5 minutes early to ensure everything is working properly.
                        </p>
                        <p style="font-size:0.9rem; color:#666;">
                            📹 Can't make it? The session will be recorded and available in your dashboard.
                        </p>
                    </div>
                    <div class="footer">
                        <p>FISSK Online Academy - Empowering students with knowledge</p>
                        <p>📍 Warri, Nigeria | 📧 hello@fissk.com</p>
                        <p style="font-size:0.8rem; color:#999;">
                            You received this because you're enrolled in ${classData.title}.
                        </p>
                    </div>
                </div>
            </body>
            </html>
        `;

        return this.sendEmail(studentEmail, subject, html);
    }
}

export default new EmailService();