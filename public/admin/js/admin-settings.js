// ===== ADMIN SETTINGS MANAGEMENT =====
class AdminSettings {
    constructor() {
        this.init();
    }
    
    async init() {
        await this.loadSettings();
        this.setupEventListeners();
    }
    
    async loadSettings() {
        try {
            const response = await fetch(`${window.AdminApp.baseUrl}/api/admin/settings`, {
                headers: window.AdminApp.getHeaders()
            });
            
            const data = await response.json();
            
            if (!data.success) {
                throw new Error(data.message || 'Failed to load settings');
            }
            
            this.populateSettings(data.settings);
            
        } catch (error) {
            console.error('Load settings error:', error);
            window.AdminApp.showToast('❌ Failed to load settings', 'error');
        }
    }
    
    populateSettings(settings) {
        if (!settings) return;
        
        document.getElementById('platformName').value = settings.platformName || 'FISSK Online Academy';
        document.getElementById('currency').value = settings.currency || 'NGN';
        document.getElementById('commissionRate').value = settings.commissionRate || 30;
        document.getElementById('minPrice').value = settings.minPrice || 1000;
        
        if (settings.emailNotifications) {
            document.getElementById('welcomeEmail').checked = settings.emailNotifications.welcomeEmail !== false;
            document.getElementById('paymentReceipt').checked = settings.emailNotifications.paymentReceipt !== false;
            document.getElementById('classReminders').checked = settings.emailNotifications.classReminders !== false;
        }
        
        document.getElementById('maintenanceMode').checked = settings.maintenanceMode || false;
    }
    
    getSettingsFromForm() {
        return {
            platformName: document.getElementById('platformName').value,
            currency: document.getElementById('currency').value,
            commissionRate: parseFloat(document.getElementById('commissionRate').value) || 30,
            minPrice: parseFloat(document.getElementById('minPrice').value) || 1000,
            emailNotifications: {
                welcomeEmail: document.getElementById('welcomeEmail').checked,
                paymentReceipt: document.getElementById('paymentReceipt').checked,
                classReminders: document.getElementById('classReminders').checked
            },
            maintenanceMode: document.getElementById('maintenanceMode').checked
        };
    }
    
    async saveSettings() {
        const saveBtn = document.querySelector('.btn-primary');
        const originalText = saveBtn.textContent;
        saveBtn.textContent = '💾 Saving...';
        saveBtn.disabled = true;
        
        try {
            const settings = this.getSettingsFromForm();
            
            // Validate commission rate
            if (settings.commissionRate < 0 || settings.commissionRate > 100) {
                window.AdminApp.showToast('❌ Commission rate must be between 0 and 100', 'error');
                saveBtn.textContent = originalText;
                saveBtn.disabled = false;
                return;
            }
            
            // Validate min price
            if (settings.minPrice < 0) {
                window.AdminApp.showToast('❌ Minimum price must be a positive number', 'error');
                saveBtn.textContent = originalText;
                saveBtn.disabled = false;
                return;
            }
            
            const response = await fetch(`${window.AdminApp.baseUrl}/api/admin/settings`, {
                method: 'PUT',
                headers: window.AdminApp.getHeaders(),
                body: JSON.stringify(settings)
            });
            
            const data = await response.json();
            
            if (data.success) {
                window.AdminApp.showToast('✅ Settings saved successfully!', 'success');
            } else {
                throw new Error(data.message || 'Failed to save settings');
            }
            
        } catch (error) {
            console.error('Save settings error:', error);
            window.AdminApp.showToast('❌ Failed to save settings', 'error');
        } finally {
            saveBtn.textContent = originalText;
            saveBtn.disabled = false;
        }
    }
    
    setupEventListeners() {
        // Auto-save on checkbox change?
        // For now, we'll let the user click Save button
    }
}

// ===== INITIALIZE =====
document.addEventListener('DOMContentLoaded', () => {
    if (document.querySelector('.admin-wrapper') && document.querySelector('#settingsForm')) {
        window.AdminSettings = new AdminSettings();
    }
});