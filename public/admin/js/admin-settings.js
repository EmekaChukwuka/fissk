// ===== ADMIN SETTINGS MANAGEMENT =====
class AdminSettingsClass {
    constructor() {
        this.isInitialized = false;
        this.init();
    }
    
    async init() {
        if (this.isInitialized) return;
        this.isInitialized = true;
        
        if (!window.AdminApp) {
            await new Promise(resolve => {
                const checkInterval = setInterval(() => {
                    if (window.AdminApp) {
                        clearInterval(checkInterval);
                        resolve();
                    }
                }, 100);
            });
        }
        
        await this.loadSettings();
        this.setupEventListeners();
        console.log('✅ AdminSettings initialized');
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
        
        const platformName = document.getElementById('platformName');
        const currency = document.getElementById('currency');
        const commissionRate = document.getElementById('commissionRate');
        const minPrice = document.getElementById('minPrice');
        
        if (platformName) platformName.value = settings.platformName || 'FISSK Online Academy';
        if (currency) currency.value = settings.currency || 'NGN';
        if (commissionRate) commissionRate.value = settings.commissionRate || 30;
        if (minPrice) minPrice.value = settings.minPrice || 1000;
        
        if (settings.emailNotifications) {
            const welcomeEmail = document.getElementById('welcomeEmail');
            const paymentReceipt = document.getElementById('paymentReceipt');
            const classReminders = document.getElementById('classReminders');
            
            if (welcomeEmail) welcomeEmail.checked = settings.emailNotifications.welcomeEmail !== false;
            if (paymentReceipt) paymentReceipt.checked = settings.emailNotifications.paymentReceipt !== false;
            if (classReminders) classReminders.checked = settings.emailNotifications.classReminders !== false;
        }
        
        const maintenanceMode = document.getElementById('maintenanceMode');
        if (maintenanceMode) maintenanceMode.checked = settings.maintenanceMode || false;
    }
    
    getSettingsFromForm() {
        return {
            platformName: document.getElementById('platformName')?.value || 'FISSK Online Academy',
            currency: document.getElementById('currency')?.value || 'NGN',
            commissionRate: parseFloat(document.getElementById('commissionRate')?.value) || 30,
            minPrice: parseFloat(document.getElementById('minPrice')?.value) || 1000,
            emailNotifications: {
                welcomeEmail: document.getElementById('welcomeEmail')?.checked || false,
                paymentReceipt: document.getElementById('paymentReceipt')?.checked || false,
                classReminders: document.getElementById('classReminders')?.checked || false
            },
            maintenanceMode: document.getElementById('maintenanceMode')?.checked || false
        };
    }
    
    async saveSettings() {
        const saveBtn = document.querySelector('.btn-primary');
        if (!saveBtn) return;
        
        const originalText = saveBtn.textContent;
        saveBtn.textContent = '💾 Saving...';
        saveBtn.disabled = true;
        
        try {
            const settings = this.getSettingsFromForm();
            
            if (settings.commissionRate < 0 || settings.commissionRate > 100) {
                window.AdminApp.showToast('❌ Commission rate must be between 0 and 100', 'error');
                saveBtn.textContent = originalText;
                saveBtn.disabled = false;
                return;
            }
            
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
        // Nothing needed yet
    }
}

// ===== CREATE GLOBAL INSTANCE =====
let AdminSettings = null;

document.addEventListener('DOMContentLoaded', function() {
    const checkInterval = setInterval(() => {
        if (window.AdminApp) {
            clearInterval(checkInterval);
            AdminSettings = new AdminSettingsClass();
            window.AdminSettings = AdminSettings;
            console.log('✅ AdminSettings registered globally');
        }
    }, 100);
    
    setTimeout(() => {
        if (!window.AdminApp) {
            console.warn('⚠️ AdminApp not found, creating AdminSettings anyway');
            AdminSettings = new AdminSettingsClass();
            window.AdminSettings = AdminSettings;
        }
    }, 5000);
});