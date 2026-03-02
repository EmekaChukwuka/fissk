// Authentication JavaScript
class AuthManager {
    constructor() {
        this.init();
    }

    init() {
        this.setupLoginForm();
        this.setupSignupForm();
        this.setupPasswordStrength();
    }

    setupLoginForm() {
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.handleLogin();
            });
        }
    }

    setupSignupForm() {
        const signupForm = document.getElementById('signupForm');
        if (signupForm) {
            signupForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.handleSignup();
            });
        }
    }

    setupPasswordStrength() {
        const passwordInput = document.getElementById('password');
        const confirmInput = document.getElementById('confirmPassword');
        
        if (passwordInput) {
            passwordInput.addEventListener('input', (e) => {
                this.checkPasswordStrength(e.target.value);
            });
        }

        if (confirmInput) {
            confirmInput.addEventListener('input', (e) => {
                this.checkPasswordMatch();
            });
        }
    }

    checkPasswordStrength(password) {
        const strengthBar = document.getElementById('passwordStrength');
        const strengthText = document.getElementById('passwordText');
        
        if (!strengthBar || !strengthText) return;

        let strength = 0;
        let text = 'Password strength';

        if (password.length >= 8) strength += 1;
        if (password.match(/[a-z]/) && password.match(/[A-Z]/)) strength += 1;
        if (password.match(/\d/)) strength += 1;
        if (password.match(/[^a-zA-Z\d]/)) strength += 1;

        strengthBar.className = 'strength-fill';
        
        if (password.length === 0) {
            strengthBar.style.width = '0%';
            strengthText.textContent = text;
        } else if (strength <= 1) {
            strengthBar.classList.add('weak');
            strengthText.textContent = 'Weak password';
        } else if (strength <= 2) {
            strengthBar.classList.add('medium');
            strengthText.textContent = 'Medium password';
        } else {
            strengthBar.classList.add('strong');
            strengthText.textContent = 'Strong password';
        }
    }

    checkPasswordMatch() {
        const password = document.getElementById('password');
        const confirm = document.getElementById('confirmPassword');
        
        if (!password || !confirm) return;

        if (confirm.value && password.value !== confirm.value) {
            confirm.style.borderColor = '#F56565';
        } else {
            confirm.style.borderColor = '';
        }
    }

    async handleLogin() {
        const form = document.getElementById('loginForm');
        const formData = new FormData(form);
        
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value.trim();
        const data = {
            email: email,
            password: password,
        };
        console.log(data)

        try {
            // Show loading state
            const submitBtn = form.querySelector('button[type="submit"]');
            const originalText = submitBtn.textContent;
            submitBtn.textContent = 'Signing in...';
            submitBtn.disabled = true;

            const response = await fetch('http://localhost:3000/register/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data.email, data.password)
            });

            const result = await response.json();

            if (response.ok) {
                // Store token and user data
                localStorage.setItem('token', result.token);
                localStorage.setItem('user', JSON.stringify(result.user));
                
                // Show success message
                this.showMessage('Login successful! Redirecting...', 'success');
                
                // Redirect to dashboard
                setTimeout(() => {
                    window.location.href = 'dashboard.html';
                }, 1500);
            } else {
                throw new Error(result.message || 'Login failed');
            }

        } catch (error) {
            this.showMessage(error.message, 'error');
        } finally {
            // Reset button state
            const submitBtn = form.querySelector('button[type="submit"]');
            if (submitBtn) {
                submitBtn.textContent = 'Sign In';
                submitBtn.disabled = false;
            }
        }
    }

    async handleSignup() {
        const form = document.getElementById('signupForm');
        const formData = new FormData(form);
        const data = {
            firstName: formData.get('firstName'),
            lastName: formData.get('lastName'),
            email: formData.get('email'),
            password: formData.get('password'),
            newsletter: document.getElementById('newsletter')
        };

        const firstName = document.getElementById('firstName').value.trim();
        const lastName = document.getElementById('lastName').value.trim();
        const name = firstName +' '+ lastName
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value.trim();
        console.log(name)
        // Validate password match
        if (data.password !== password) {
            this.showMessage('Passwords do not match', 'error');
            return;
        }

        try {
            // Show loading state
            const submitBtn = form.querySelector('button[type="submit"]');
            const originalText = submitBtn.textContent;
            submitBtn.textContent = 'Creating account...';
            submitBtn.disabled = true;

            const response = await fetch('http://localhost:3000/register/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(name, email, password)
            });

            const result = await response.json();

            if (response.ok) {
                this.showMessage('Account created successfully!', 'success');
                
                // Redirect to login after delay
                setTimeout(() => {
                    window.location.href = 'login.html';
                }, 3000);
            } else {
                throw new Error(result.message || 'Signup failed');
            }

        } catch (error) {
            this.showMessage(error.message, 'error');
            console.log(error)
        } finally {
            // Reset button state
            const submitBtn = form.querySelector('button[type="submit"]');
            if (submitBtn) {
                submitBtn.textContent = 'Create Account';
                submitBtn.disabled = false;
            }
        }
    }

    showMessage(message, type) {
        // Remove existing messages
        const existingMessage = document.querySelector('.auth-message');
        if (existingMessage) {
            existingMessage.remove();
        }

        // Create message element
        const messageEl = document.createElement('div');
        messageEl.className = `auth-message auth-message-${type}`;
        messageEl.textContent = message;

        // Add styles
        messageEl.style.cssText = `
            padding: 15px;
            margin-bottom: 20px;
            border-radius: 10px;
            text-align: center;
            font-weight: 500;
            background: ${type === 'success' ? '#48BB78' : '#F56565'};
            color: white;
        `;

        // Insert message
        const form = document.querySelector('.auth-form');
        if (form) {
            form.insertBefore(messageEl, form.firstChild);
        }

        // Auto remove after 5 seconds
        setTimeout(() => {
            messageEl.remove();
        }, 5000);
    }
}

// Initialize auth manager
document.addEventListener('DOMContentLoaded', () => {
    new AuthManager();
});