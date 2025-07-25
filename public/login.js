document.addEventListener('DOMContentLoaded', () => {
    const loginView = document.getElementById('login-view');
    const setPasswordView = document.getElementById('set-password-view');
    const loginForm = document.getElementById('login-form');
    const setPasswordForm = document.getElementById('set-password-form');
    const loginError = document.getElementById('login-error');
    const setPasswordError = document.getElementById('set-password-error');
    const setPasswordUsername = document.getElementById('set-password-username');

    // Redirect if already logged in
    const token = localStorage.getItem('corkyTubeToken');
    if (token) {
        window.location.href = 'index.html';
        return;
    }

    // Handle Login Form Submission
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;

        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (response.ok) {
                if (data.requiresPasswordChange) {
                    // Show set password form
                    loginView.style.display = 'none';
                    setPasswordUsername.value = data.username; // Store username
                    setPasswordView.style.display = 'block';
                } else {
                    // Successful login
                    localStorage.setItem('corkyTubeToken', data.token);
                    window.location.href = 'index.html';
                }
            } else {
                loginError.textContent = data.message || 'Login failed.';
                loginError.style.display = 'block';
            }
        } catch (error) {
            console.error('Login error:', error);
            loginError.textContent = 'An error occurred. Please try again.';
            loginError.style.display = 'block';
        }
    });

    // Handle Set Password Form Submission
    setPasswordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = setPasswordUsername.value;
        const newPassword = document.getElementById('new-password').value;
        const confirmPassword = document.getElementById('confirm-password').value;

        if (newPassword !== confirmPassword) {
            setPasswordError.textContent = 'Passwords do not match.';
            setPasswordError.style.display = 'block';
            return;
        }

        try {
            const response = await fetch('/api/set-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password: newPassword })
            });

            const data = await response.json();

            if (response.ok) {
                // Password set, now log in
                localStorage.setItem('corkyTubeToken', data.token);
                window.location.href = 'index.html';
            } else {
                setPasswordError.textContent = data.message || 'Failed to set password.';
                setPasswordError.style.display = 'block';
            }
        } catch (error) {
            console.error('Set password error:', error);
            setPasswordError.textContent = 'An error occurred. Please try again.';
            setPasswordError.style.display = 'block';
        }
    });
});