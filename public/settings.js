document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('corkyTubeToken');
    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    const payload = JSON.parse(atob(token.split('.')[1]));
    document.getElementById('username').textContent = payload.username;
    document.getElementById('role').textContent = payload.role;

    const changePasswordForm = document.getElementById('change-password-form');
    const changePasswordStatus = document.getElementById('change-password-status');

    changePasswordForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const currentPassword = document.getElementById('current-password').value;
        const newPassword = document.getElementById('new-password').value;
        const confirmPassword = document.getElementById('confirm-password').value;

        if (newPassword !== confirmPassword) {
            changePasswordStatus.textContent = 'New passwords do not match.';
            changePasswordStatus.style.color = 'red';
            changePasswordStatus.style.display = 'block';
            return;
        }

        try {
            const response = await fetch('/api/user/change-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ currentPassword, newPassword })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Failed to change password.');
            }

            changePasswordStatus.textContent = data.message;
            changePasswordStatus.style.color = 'green';
            changePasswordStatus.style.display = 'block';
            changePasswordForm.reset();

        } catch (err) {
            changePasswordStatus.textContent = `Error: ${err.message}`;
            changePasswordStatus.style.color = 'red';
            changePasswordStatus.style.display = 'block';
        }
    });

    async function fetchLastUpdated() {
        try {
            const response = await fetch('/api/last-updated', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to fetch last updated timestamp.');
            }
            const data = await response.json();
            if (data.last_updated) {
                const lastUpdatedElem = document.getElementById('last-updated-value');
                const date = new Date(data.last_updated);
                const year = date.getFullYear();
                const month = (date.getMonth() + 1).toString().padStart(2, '0');
                const day = date.getDate().toString().padStart(2, '0');
                const hours = date.getHours().toString().padStart(2, '0');
                const minutes = date.getMinutes().toString().padStart(2, '0');
                const today = new Date();
                const yesterday = new Date(today);
                yesterday.setDate(yesterday.getDate() - 1);

                let formattedDate;
                if (date.toDateString() === today.toDateString()) {
                    formattedDate = `Today at ${hours}:${minutes}`;
                } else if (date.toDateString() === yesterday.toDateString()) {
                    formattedDate = `Yesterday at ${hours}:${minutes}`;
                } else {
                    formattedDate = `${year}-${month}-${day} ${hours}:${minutes}`;
                }
                lastUpdatedElem.textContent = formattedDate;
            }
        } catch (err) {
            console.error('Error fetching last updated timestamp:', err);
            // Don't show an error on the main page for this, just log it
        }
    }

    fetchLastUpdated();
});