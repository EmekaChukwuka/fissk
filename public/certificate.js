// ============================================================
// CERTIFICATE - View and Download Certificates
// ============================================================

(function() {
    'use strict';

    const state = {
        user: JSON.parse(localStorage.getItem('user')),
        token: localStorage.getItem('token'),
        certificates: []
    };

    const elements = {
        container: document.getElementById('certificatesContainer'),
        modal: document.getElementById('certificateModal'),
        content: document.getElementById('certificateContent'),
        downloadBtn: document.getElementById('downloadCertBtn')
    };

    // ===== INIT =====
    async function init() {
        if (!state.user || !state.token) {
            window.location.href = 'login.html';
            return;
        }

        loadUserData();
        await loadCertificates();
    }

    // ===== LOAD USER DATA =====
    function loadUserData() {
        const userDropdown = document.getElementById('user-dropdown');
        if (userDropdown && state.user) {
            userDropdown.innerHTML = `
                <img src="https://ui-avatars.com/api/?name=${state.user.firstname}+${state.user.lastname}&background=8B5FBF&color=fff" alt="User" class="user-avatar">
                <span>${state.user.firstname}</span>
                <div class="dropdown-content">
                    <a href="profile.html">Profile</a>
                    <a href="#" class="logout" onclick="logout()">Logout</a>
                </div>
            `;
        }
    }

    // ===== LOAD CERTIFICATES =====
    async function loadCertificates() {
        try {
            const response = await fetch('https://fissk-backend.onrender.com/api/certificates/user', {
                headers: { 'Authorization': `Bearer ${state.token}` }
            });

            if (!response.ok) throw new Error('Failed to load certificates');

            const data = await response.json();
            state.certificates = data.certificates || [];
            renderCertificates();
        } catch (error) {
            console.error('Load certificates error:', error);
            elements.container.innerHTML = `
                <div class="no-certificates" style="grid-column: 1 / -1;">
                    <span class="icon">❌</span>
                    <h3>Failed to Load Certificates</h3>
                    <p>${error.message}</p>
                    <button class="btn btn-primary" onclick="location.reload()">Retry</button>
                </div>
            `;
        }
    }

    // ===== RENDER CERTIFICATES =====
    function renderCertificates() {
        if (state.certificates.length === 0) {
            elements.container.innerHTML = `
                <div class="no-certificates" style="grid-column: 1 / -1;">
                    <span class="icon">🎓</span>
                    <h3>No Certificates Yet</h3>
                    <p>Complete a course to earn your first certificate!</p>
                    <a href="classes.html" class="btn btn-primary">Browse Classes</a>
                </div>
            `;
            return;
        }

        elements.container.innerHTML = state.certificates.map(cert => {
            const gradeClass = cert.grade?.toLowerCase() || 'pass';
            const issueDate = new Date(cert.issueDate).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });

            return `
                <div class="certificate-card">
                    <div class="cert-icon">📜</div>
                    <h3>${escapeHtml(cert.studentName)}</h3>
                    <div class="course-title">${escapeHtml(cert.courseTitle || cert.classId?.title || 'Course')}</div>
                    <div class="cert-details">
                        <span>📅 ${issueDate}</span>
                        <span>🏷️ ${escapeHtml(cert.certificateNumber)}</span>
                        <span class="grade-badge ${gradeClass}">${escapeHtml(cert.grade || 'Pass')}</span>
                    </div>
                    <div class="cert-actions">
                        <button class="btn btn-primary view-cert-btn" data-id="${cert._id}">
                            👁️ View
                        </button>
                        <button class="btn btn-outline download-cert-btn" data-id="${cert._id}">
                            📥 Download
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        // Add event listeners
        document.querySelectorAll('.view-cert-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.id;
                viewCertificate(id);
            });
        });

        document.querySelectorAll('.download-cert-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.id;
                downloadCertificate(id);
            });
        });
    }

    // ===== VIEW CERTIFICATE =====
    async function viewCertificate(certId) {
        try {
            const response = await fetch(`https://fissk-backend.onrender.com/api/certificates/${certId}`, {
                headers: { 'Authorization': `Bearer ${state.token}` }
            });

            if (!response.ok) throw new Error('Failed to load certificate');

            const data = await response.json();
            const cert = data.certificate;

            // Generate certificate HTML
            const html = generateCertificateHTML(cert);
            elements.content.innerHTML = html;
            elements.modal.style.display = 'flex';

            // Set download button
            elements.downloadBtn.onclick = () => downloadCertificate(certId);
        } catch (error) {
            console.error('View certificate error:', error);
            showToast('Failed to load certificate', 'error');
        }
    }

    // ===== GENERATE CERTIFICATE HTML =====
    function generateCertificateHTML(cert) {
        const issueDate = new Date(cert.issueDate).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        const borderColor = '#8B5FBF';
        const primaryColor = '#8B5FBF';
        const textColor = '#1A1A2E';

        return `
            <div style="text-align: center; padding: 20px;">
                <div style="display: inline-block; padding: 4px 16px; background: ${primaryColor}; color: white; border-radius: 30px; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 16px;">
                    🎓 Certificate of Completion
                </div>
                
                <div style="font-size: 2.2rem; font-weight: 700; color: ${primaryColor}; margin-bottom: 4px;">
                    FISSK <span style="color: ${textColor}; font-weight: 300;">Academy</span>
                </div>
                
                <h1 style="font-size: 2rem; color: ${textColor}; margin: 12px 0 4px;">Certificate of Completion</h1>
                <p style="color: #6B7280; font-size: 1.1rem;">This certificate is proudly presented to</p>
                
                <div style="font-size: 2.8rem; color: ${primaryColor}; font-weight: 700; margin: 12px 0; letter-spacing: 2px;">
                    ${escapeHtml(cert.studentName)}
                </div>
                
                <p style="color: #4a5568; font-size: 1.05rem;">
                    For successfully completing the course
                </p>
                
                <div style="font-size: 1.6rem; color: ${textColor}; font-weight: 600; margin: 8px 0;">
                    "${escapeHtml(cert.courseTitle || cert.classId?.title || 'Course')}"
                </div>
                
                <div style="margin: 12px 0; padding: 8px 20px; background: #f8f4ff; border-radius: 8px; display: inline-block;">
                    <span style="font-size: 0.85rem; color: #6B7280;">Grade: </span>
                    <span style="font-size: 1.2rem; font-weight: 700; color: ${primaryColor};">${escapeHtml(cert.grade || 'Pass')}</span>
                    ${cert.score > 0 ? `<span style="color: #6B7280; margin-left: 8px;">• ${cert.score}%</span>` : ''}
                </div>
                
                <p style="color: #6B7280; font-size: 0.9rem; margin-top: 8px;">
                    ${escapeHtml(cert.classId?.level || 'Beginner')} Level • Completed on ${issueDate}
                </p>
                
                <div style="margin-top: 24px; padding-top: 16px; border-top: 2px solid #f0f0f0; display: flex; justify-content: space-between; align-items: flex-end; flex-wrap: wrap; gap: 16px;">
                    <div style="text-align: left;">
                        <div style="width: 160px; height: 2px; background: ${textColor}; margin-bottom: 4px;"></div>
                        <div style="font-weight: 600; color: ${textColor};">FISSK Academy</div>
                        <div style="font-size: 0.8rem; color: #6B7280;">Authorized Signature</div>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-weight: 600; color: ${textColor};">${issueDate}</div>
                        <div style="font-size: 0.8rem; color: #6B7280;">Date Issued</div>
                    </div>
                </div>
                
                <div style="font-size: 0.7rem; color: #9CA3AF; margin-top: 16px; font-family: monospace;">
                    Certificate ID: ${escapeHtml(cert.certificateNumber)}
                </div>
            </div>
        `;
    }

    // ===== DOWNLOAD CERTIFICATE =====
    async function downloadCertificate(certId) {
        try {
            // Open in new tab for printing/saving
            const url = `https://fissk-backend.onrender.com/api/certificates/${certId}/download`;
            window.open(url, '_blank');
            showToast('📥 Certificate opened in new tab. You can save it as PDF.', 'success');
        } catch (error) {
            console.error('Download certificate error:', error);
            showToast('Failed to download certificate', 'error');
        }
    }

    // ===== CLOSE MODAL =====
    function closeCertificateModal() {
        elements.modal.style.display = 'none';
    }

    // ===== HELPERS =====
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function showToast(message, type) {
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            padding: 14px 24px;
            border-radius: 12px;
            background: ${type === 'success' ? '#10B981' : type === 'error' ? '#EF4444' : '#6C3CE1'};
            color: white;
            z-index: 10000;
            box-shadow: 0 4px 20px rgba(0,0,0,0.2);
            max-width: 400px;
            font-weight: 500;
            animation: slideIn 0.3s ease;
        `;
        toast.textContent = message;
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(20px)';
            toast.style.transition = 'all 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    }

    function logout() {
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        window.location.href = 'index.html';
    }

    // ===== EVENT LISTENERS =====
    document.addEventListener('click', (e) => {
        if (e.target === elements.modal) {
            closeCertificateModal();
        }
    });

    // ===== START =====
    document.addEventListener('DOMContentLoaded', init);

    // Expose functions globally
    window.closeCertificateModal = closeCertificateModal;
    window.downloadCertificate = downloadCertificate;
})();