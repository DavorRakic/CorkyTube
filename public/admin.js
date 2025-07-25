document.addEventListener('DOMContentLoaded', () => {
    const userTableBody = document.querySelector('#users-table tbody');
    const patreonsDisplay = document.getElementById('patreons-display');
    const editPatreonsBtn = document.getElementById('edit-patreons-btn');
    const editPatreonsDialog = document.getElementById('edit-patreons-dialog');
    const editPatreonsForm = document.getElementById('edit-patreons-form');
    const patreonsTextarea = document.getElementById('patreons-textarea');
    const closeEditPatreonsDialogBtn = editPatreonsDialog.querySelector('.close-button');
    const syncYoutubeBtn = document.getElementById('sync-youtube-btn');
    const syncStatus = document.getElementById('sync-status');
    const token = localStorage.getItem('corkyTubeToken');

    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    const payload = JSON.parse(atob(token.split('.')[1]));
    if (payload.role !== 'admin') {
        window.location.href = 'index.html';
        return;
    }

    function displayError(message) {
        alert(message);
    }

    async function fetchUsers() {
        try {
            const response = await fetch('/api/users', { headers: { 'Authorization': `Bearer ${token}` } });
            if (!response.ok) throw new Error('Failed to fetch users.');
            const users = await response.json();
            userTableBody.innerHTML = '';
            users.forEach(user => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${user.username}</td>
                    <td>${user.role}</td>
                    <td>${user.temp_password_active ? 'Temporary (Needs Reset)' : 'Set by User'}</td>
                    <td class="actions">
                        <button class="toggle-btn reset-btn" data-username="${user.username}" title="Reset Password" ${user.role === 'admin' ? 'disabled' : ''}><i class="fas fa-key"></i></button>
                        <button class="toggle-btn delete-btn" data-id="${user.id}" data-username="${user.username}" title="Delete User" ${user.role === 'admin' ? 'disabled' : ''}><i class="fas fa-trash-alt"></i></button>
                    </td>
                `;
                userTableBody.appendChild(row);
            });
        } catch (err) {
            displayError(err.message);
        }
    }

    async function fetchPatreons() {
        try {
            const response = await fetch('/api/patreons', { headers: { 'Authorization': `Bearer ${token}` } });
            if (!response.ok) throw new Error('Failed to fetch patreons.');
            const patreons = await response.json();
            patreonsDisplay.textContent = patreons.join(', ');
            patreonsTextarea.value = patreons.join('\n');
        } catch (err) {
            displayError(err.message);
        }
    }

    editPatreonsBtn.addEventListener('click', () => {
        editPatreonsDialog.style.display = 'block';
    });

    closeEditPatreonsDialogBtn.addEventListener('click', () => {
        editPatreonsDialog.style.display = 'none';
    });

    editPatreonsForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const updatedPatreons = patreonsTextarea.value.split('\n').map(p => p.trim()).filter(p => p);
        try {
            const response = await fetch('/api/patreons', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ patreons: updatedPatreons })
            });
            if (!response.ok) throw new Error('Failed to update patreons.');
            editPatreonsDialog.style.display = 'none';
            await fetchPatreons();
            await fetchUsers();
            alert('Patreons list updated successfully.');
        } catch (err) {
            displayError(err.message);
        }
    });

    syncYoutubeBtn.addEventListener('click', async () => {
        syncStatus.style.display = 'block';
        syncStatus.textContent = 'Syncing... Please wait, this may take a while.';
        syncYoutubeBtn.disabled = true;

        try {
            const response = await fetch('/api/sync-youtube', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to sync YouTube data.');
            }

            const data = await response.json();
            syncStatus.textContent = data.message;
            syncStatus.style.color = 'green';
            // Optionally refresh dashboard data or last updated timestamp
            // You might need to add a function to app.js/content.js to refresh these
            // For now, just update the status message.

        } catch (err) {
            syncStatus.textContent = `Error: ${err.message}`;
            syncStatus.style.color = 'red';
            console.error('YouTube Sync Error:', err);
        } finally {
            syncYoutubeBtn.disabled = false;
            // Re-fetch last updated timestamp after sync attempt
            fetchLastUpdated();
        }
    });

    const resetPasswordDialog = document.getElementById('reset-password-dialog');
    const resetPasswordForm = document.getElementById('reset-password-form');
    const resetUsernameSpan = document.getElementById('reset-username');
    const closeResetPasswordDialogBtn = resetPasswordDialog.querySelector('.close-button');
    let userIdToDelete = null;
    let usernameToReset = null;

    userTableBody.addEventListener('click', async (e) => {
        const target = e.target.closest('button');
        if (!target) return;

        if (target.classList.contains('reset-btn')) {
            usernameToReset = target.dataset.username;
            resetUsernameSpan.textContent = usernameToReset;
            resetPasswordDialog.style.display = 'block';
        }

        if (target.classList.contains('delete-btn')) {
            userIdToDelete = target.dataset.id;
            const username = target.dataset.username;
            if (confirm(`Are you sure you want to delete the user "${username}"? This action cannot be undone.`)) {
                try {
                    const response = await fetch(`/api/users/${userIdToDelete}`, {
                        method: 'DELETE',
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    if (!response.ok) throw new Error('Failed to delete user.');
                    await fetchUsers();
                    alert('User deleted successfully.');
                } catch (err) {
                    displayError(err.message);
                }
            }
        }
    });

    closeResetPasswordDialogBtn.addEventListener('click', () => {
        resetPasswordDialog.style.display = 'none';
    });

    resetPasswordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const newPassword = document.getElementById('new-password').value;
        if (!newPassword) {
            displayError('Please enter a new password.');
            return;
        }

        try {
            const response = await fetch('/api/reset-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ username: usernameToReset, newPassword })
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to reset password.');
            }
            resetPasswordDialog.style.display = 'none';
            resetPasswordForm.reset();
            await fetchUsers();
            alert('Password reset successfully.');
        } catch (err) {
            displayError(err.message);
        }
    });

    // Initial Load
    fetchUsers();
    fetchPatreons();

    // Function to fetch and display last updated timestamp (from app.js/content.js)
    async function fetchLastUpdated() {
        try {
            const response = await fetch('/api/last-updated', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) {
                const contentType = response.headers.get("content-type");
                if (contentType && contentType.indexOf("application/json") !== -1) {
                    const errorData = await response.json();
                    throw new Error(errorData.message || 'Failed to fetch last updated timestamp.');
                } else {
                    const errorText = await response.text();
                    throw new Error(`Server error: ${errorText}`);
                }
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
        }
    }

    fetchLastUpdated();
});