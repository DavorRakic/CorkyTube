
document.addEventListener('DOMContentLoaded', () => {
    const userSessionElement = document.getElementById('user-session');
    const token = localStorage.getItem('corkyTubeToken');

    if (!token) {
        // Allow access to login page
        if (!window.location.pathname.endsWith('login.html')) {
            window.location.href = 'login.html';
        }
        return;
    }

    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        
        if (userSessionElement) {
            let adminLink = '';
            if (payload.role === 'admin') {
                adminLink = `<a href="admin.html"><i class="fas fa-user-shield"></i> Admin</a>`;
            }

            userSessionElement.innerHTML = `
                <div class="user-info user-button">
                    <i class="fas fa-bars"></i>
                </div>
                <div class="dropdown-content user-dropdown">
                    <div class="dropdown-header">
                        <i class="fas fa-user-circle"></i>
                        <span class="username">${payload.username}</span>
                    </div>
                    <a href="index.html"><i class="fas fa-tachometer-alt"></i> Dashboard</a>
                    <a href="content.html"><i class="fas fa-play-circle"></i> Content</a>
                    ${adminLink}
                    <a href="#" id="online-users-btn"><i class="fas fa-users"></i> Online Users</a>
                    <a href="settings.html"><i class="fas fa-cog"></i> Settings</a>
                    <a href="#" id="logout-btn"><i class="fas fa-sign-out-alt"></i> Logout</a>
                </div>
            `;

            const userButton = userSessionElement.querySelector('.user-button');
            const userDropdown = userSessionElement.querySelector('.user-dropdown');
            const onlineUsersDialog = document.getElementById('online-users-dialog');

            userButton.addEventListener('click', (e) => {
                e.stopPropagation();
                userDropdown.classList.toggle('show');
            });

            if (onlineUsersDialog) {
                const closeButton = onlineUsersDialog.querySelector('.close-button');
                const onlineUsersList = document.getElementById('online-users-list');

                document.getElementById('online-users-btn').addEventListener('click', async (e) => {
                    e.preventDefault();
                    userDropdown.classList.remove('show'); // Close dropdown
                    try {
                        const response = await fetch('/api/online-users', {
                            headers: { 'Authorization': `Bearer ${token}` }
                        });
                        if (!response.ok) throw new Error('Failed to fetch');
                        const users = await response.json();
                        onlineUsersList.innerHTML = '';
                        users.forEach(user => {
                            const li = document.createElement('li');
                            li.textContent = user.username;
                            onlineUsersList.appendChild(li);
                        });
                        onlineUsersDialog.style.display = 'flex';
                    } catch (error) {
                        console.error('Failed to fetch online users:', error);
                    }
                });

                if (closeButton) {
                    closeButton.addEventListener('click', () => {
                        onlineUsersDialog.style.display = 'none';
                    });
                }
            }

            document.getElementById('logout-btn').addEventListener('click', async () => {
                try {
                    await fetch('/api/logout', {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                } catch (error) {
                    console.error('Logout failed:', error);
                }
                localStorage.removeItem('corkyTubeToken');
                window.location.href = 'login.html';
            });

            // Combined click handler for closing dropdown and dialog
            window.addEventListener('click', (e) => {
                // Close dropdown if clicking outside
                if (userButton && !userButton.contains(e.target) && userDropdown.classList.contains('show')) {
                    userDropdown.classList.remove('show');
                }
                // Close dialog if clicking on the background
                if (onlineUsersDialog && e.target === onlineUsersDialog) {
                    onlineUsersDialog.style.display = 'none';
                }
            });
        }
    } catch (e) {
        console.error('Invalid token:', e);
        localStorage.removeItem('corkyTubeToken');
        window.location.href = 'login.html';
    }
});
