const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const path = require('path');
const https = require('https');

const app = express();
app.get('/', (req, res) => {
  res.sendStatus(200);
});
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

const JWT_SECRET = 'your_super_secret_key';

require('dotenv').config();
const API_KEY = JSON.parse(process.env.GOOGLE_API_KEY);
const CHANNEL_ID = JSON.parse(process.env.YT_CHANNEL_ID);

const saltRounds = 10;
const TEMP_PASSWORD = JSON.parse(process.env.TEMP_PASSWORD);

// --- Database Setup ---
const db = new sqlite3.Database('./corkytube.db', (err) => {
    if (err) {
        return console.error('Error opening database', err.message);
    }
    console.log('Connected to the SQLite database.');

    db.serialize(() => {
        // Create Tables
        db.run(`CREATE TABLE IF NOT EXISTS users ( id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE NOT NULL, password TEXT NOT NULL, role TEXT DEFAULT 'user', temp_password_active BOOLEAN DEFAULT 0)`);
        db.run(`CREATE TABLE IF NOT EXISTS patreons (username TEXT PRIMARY KEY)`);
        db.run(`CREATE TABLE IF NOT EXISTS favorites ( id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, video_id TEXT NOT NULL, FOREIGN KEY (user_id) REFERENCES users (id), UNIQUE(user_id, video_id))`);
        db.run(`CREATE TABLE IF NOT EXISTS youtube_content ( id TEXT PRIMARY KEY, title TEXT NOT NULL, thumbnail TEXT NOT NULL, views INTEGER DEFAULT 0, likes INTEGER DEFAULT 0, comments INTEGER DEFAULT 0, type TEXT NOT NULL, published_at DATETIME NOT NULL)`);
        db.run(`CREATE TABLE IF NOT EXISTS channel_stats ( id INTEGER PRIMARY KEY CHECK (id = 1), subscribers_count INTEGER, last_updated TEXT, patreons_list TEXT)`);
        db.run(`CREATE TABLE IF NOT EXISTS online_users ( user_id INTEGER PRIMARY KEY, username TEXT NOT NULL, login_time TEXT NOT NULL)`);

        // Setup Admins
		//const admins = JSON.parse(process.env.ADMINS_LIST);
		let admins = [];
		try {
		  admins = JSON.parse(process.env.ADMINS_LIST || '[]');
		} catch (err) {
		  console.error('Failed to parse ADMINS_LIST:', err);
		}

        admins.forEach(admin => {
            bcrypt.hash(admin.password, saltRounds, (err, hash) => {
                if (err) return;
                db.run(`INSERT INTO users (username, password, role, temp_password_active) VALUES (?, ?, 'admin', 0) ON CONFLICT(username) DO UPDATE SET password = excluded.password, role = excluded.role, temp_password_active = excluded.temp_password_active`, [admin.username, hash]);
            });
        });

        // Initial Patreons
        db.get("SELECT COUNT(*) as count FROM patreons", (err, row) => {
            if (row && row.count === 0) {
                const initialPatreons = ['michael', 'paul', 'daniele', 'dora', 'davor', 'corky', 'kico'];
                const stmt = db.prepare("INSERT OR IGNORE INTO patreons (username) VALUES (?)");
                initialPatreons.forEach(p => stmt.run(p));
                stmt.finalize();
            }
        });
    });
});


// --- API Endpoints ---

// User Login
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    const lowerCaseUsername = username.toLowerCase();

    db.get('SELECT * FROM users WHERE username = ?', [lowerCaseUsername], async (err, user) => {
        if (err || !user) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const match = await bcrypt.compare(password, user.password);
        if (match) {
            if (user.temp_password_active) {
                return res.json({ requiresPasswordChange: true, username: user.username });
            }
            const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
            db.run('REPLACE INTO online_users (user_id, username, login_time) VALUES (?, ?, ?)', [user.id, user.username, new Date().toISOString()]);
            res.json({ message: 'Login successful', token });
        } else {
            res.status(401).json({ message: 'Invalid credentials' });
        }
    });
});

app.post('/api/logout', (req, res) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.sendStatus(200);
    const decoded = jwt.decode(token);
    if (decoded && decoded.id) {
        db.run('DELETE FROM online_users WHERE user_id = ?', [decoded.id]);
    }
    res.status(200).json({ message: 'Logout successful' });
});

// Patreon First-time Password Set
app.post('/api/set-password', (req, res) => {
    const { username, password } = req.body;
    const lowerCaseUsername = username.toLowerCase();

    db.get("SELECT * FROM patreons WHERE username = ?", [lowerCaseUsername], async (err, patreon) => {
        if (err || !patreon) {
            return res.status(403).json({ message: 'Permission denied.' });
        }
        try {
            const hashedPassword = await bcrypt.hash(password, saltRounds);
            db.run(`INSERT INTO users (username, password, role, temp_password_active) VALUES (?, ?, 'user', 0) ON CONFLICT(username) DO UPDATE SET password = excluded.password, temp_password_active = 0`, [lowerCaseUsername, hashedPassword], function(err) {
                if (err) return res.status(500).json({ message: 'Error setting password' });
                db.get('SELECT * FROM users WHERE username = ?', [lowerCaseUsername], (err, user) => {
                    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
                    res.status(200).json({ message: 'Password set successfully!', token });
                });
            });
        } catch (error) {
            res.status(500).json({ message: 'Server error' });
        }
    });
});

// --- Middleware ---
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) return res.sendStatus(401);
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
}

function isAdmin(req, res, next) {
    if (req.user.role !== 'admin') return res.sendStatus(403);
    next();
}

// --- Admin Endpoints ---
app.get('/api/users', authenticateToken, isAdmin, (req, res) => {
    db.all("SELECT id, username, role, temp_password_active FROM users ORDER BY username", [], (err, users) => {
        if (err) return res.status(500).json({ message: "Error retrieving users" });
        res.json(users);
    });
});

app.delete('/api/users/:id', authenticateToken, isAdmin, (req, res) => {
    const { id } = req.params;
    db.get("SELECT username FROM users WHERE id = ?", [id], (err, user) => {
        if(err || !user) return res.status(404).json({ message: "User not found" });
        if (['corky', 'kico'].includes(user.username)) {
            return res.status(403).json({ message: "Cannot delete core admin users." });
        }
        db.run('DELETE FROM users WHERE id = ?', [id], (err) => {
            if (err) return res.status(500).json({ message: "Error deleting user" });
            res.json({ message: "User deleted successfully" });
        });
    });
});

app.post('/api/reset-password', authenticateToken, isAdmin, async (req, res) => {
    const { username, newPassword } = req.body;

    if (['corky', 'kico'].includes(username.toLowerCase())) {
        return res.status(403).json({ message: "Cannot reset password for core admin users." });
    }

    try {
        const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);
        db.run('UPDATE users SET password = ?, temp_password_active = 1 WHERE username = ?', [hashedNewPassword, username], function(err) {
            if (err) {
                return res.status(500).json({ message: 'Error resetting password.' });
            }
            if (this.changes === 0) {
                return res.status(404).json({ message: 'User not found.' });
            }
            res.json({ message: 'Password has been reset successfully. User will be required to change it on next login.' });
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error during password reset.' });
    }
});

// --- Patreon Management ---
app.get('/api/patreons', authenticateToken, isAdmin, (req, res) => {
    db.all("SELECT username FROM patreons ORDER BY username", [], (err, rows) => {
        if (err) return res.status(500).json({ message: "Error fetching patreons." });
        res.json(rows.map(r => r.username));
    });
});

app.post('/api/patreons', authenticateToken, isAdmin, (req, res) => {
    const newPatreons = req.body.patreons;
    if (!Array.isArray(newPatreons)) {
        return res.status(400).json({ message: "Invalid data format." });
    }

    const patreonUsernames = newPatreons.map(p => p.toLowerCase().trim()).filter(p => p);

    db.serialize(() => {
        db.run("BEGIN TRANSACTION");
        db.run("DELETE FROM patreons");
        const stmt = db.prepare("INSERT INTO patreons (username) VALUES (?)");
        patreonUsernames.forEach(p => stmt.run(p));
        stmt.finalize(err => {
            if (err) {
                db.run("ROLLBACK");
                return res.status(500).json({ message: "Failed to update patreons list." });
            }
            
            db.all("SELECT username FROM users", (err, allUsers) => {
                if (err) {
                    db.run("ROLLBACK");
                    return res.status(500).json({ message: "Failed to fetch users for sync." });
                }

                const existingUsernames = new Set(allUsers.map(u => u.username));
                const patreonSet = new Set(patreonUsernames);

                const usersToAdd = patreonUsernames.filter(p => !existingUsernames.has(p));
                const addUserStmt = db.prepare("INSERT OR IGNORE INTO users (username, password, role, temp_password_active) VALUES (?, ?, 'user', 1)");
                usersToAdd.forEach(u => addUserStmt.run(u, ''));
                addUserStmt.finalize();

                const usersToRemove = [...existingUsernames].filter(u => !patreonSet.has(u) && !['corky', 'kico'].includes(u));
                const removeUserStmt = db.prepare("DELETE FROM users WHERE username = ?");
                usersToRemove.forEach(u => removeUserStmt.run(u));
                removeUserStmt.finalize();

                db.run("COMMIT", (err) => {
                    if (err) {
                        db.run("ROLLBACK");
                        return res.status(500).json({ message: "Failed to sync users with patreons list." });
                    }
                    res.json({ message: "Patreons list updated and users synced successfully." });
                });
            });
        });
    });
});

// --- YouTube Data Sync ---
app.post('/api/sync-youtube', authenticateToken, isAdmin, async (req, res) => {
    console.log('Starting YouTube data sync...');
    const status = {
        channel: 'pending',
        videos: 'pending',
        shorts: 'pending',
        error: null
    };

    try {
        // 1. Fetch Channel Stats
        const channelUrl = `https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${CHANNEL_ID}&key=${API_KEY}`;
        const channelData = await fetchJson(channelUrl);
        const subscribersCount = channelData.items[0].statistics.subscriberCount;
        const lastUpdated = new Date().toISOString();
        db.run(`REPLACE INTO channel_stats (id, subscribers_count, last_updated) VALUES (1, ?, ?)`, [subscribersCount, lastUpdated]);
        status.channel = 'success';
        console.log('Channel stats synced.');

        // 2. Fetch all videos and shorts from the channel
        let allVideos = [];
        let nextPageToken = '';
        do {
            const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${CHANNEL_ID}&maxResults=50&order=date&type=video&pageToken=${nextPageToken}&key=${API_KEY}`;
            const searchData = await fetchJson(searchUrl);
            
            const videoIds = searchData.items.map(item => item.id.videoId).join(',');
            if (videoIds) {
                const videoDetailsUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${videoIds}&key=${API_KEY}`;
                const videoDetailsData = await fetchJson(videoDetailsUrl);
                allVideos.push(...videoDetailsData.items);
            }
            nextPageToken = searchData.nextPageToken;
        } while (nextPageToken);
        
        console.log(`Found ${allVideos.length} total content items.`);
        status.videos = 'fetched'; // Indicate videos are fetched, not yet saved
        status.shorts = 'fetched'; // Indicate shorts are fetched, not yet saved

        // 3. Process and store content
        db.serialize(() => {
            db.run("BEGIN TRANSACTION");
            const stmt = db.prepare(`
                INSERT OR REPLACE INTO youtube_content 
                (id, title, thumbnail, views, likes, comments, type, published_at) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `);
            
            allVideos.forEach(video => {
                console.log(`Processing video: ${video.id} - ${video.snippet.title}`);
                const isShort = video.contentDetails.duration.includes('M') ? false : true; // Simple check
                let cleanedTitle = video.snippet.title;
                if (isShort) {
                    cleanedTitle = cleanedTitle.replace(/#\w+/g, '').replace(/\s+/g, ' ').trim(); // Remove hashtags and normalize spaces
                }
                stmt.run(
                    video.id,
                    cleanedTitle,
                    video.snippet.thumbnails.high.url,
                    video.statistics.viewCount || 0,
                    video.statistics.likeCount || 0,
                    video.statistics.commentCount || 0,
                    isShort ? 'short' : 'video',
                    video.snippet.publishedAt
                );
            });

            stmt.finalize(err => {
                if (err) {
                    db.run("ROLLBACK");
                    status.error = 'Failed to save video data.';
                    console.error('Sync error during finalize:', err);
                    return res.status(500).json({ message: status.error });
                }
                console.log('Statement finalized. Attempting to commit transaction.');
                db.run("COMMIT", (commitErr) => {
                    if (commitErr) {
                         status.error = 'Failed to commit video data.';
                         console.error('Sync commit error:', commitErr);
                         return res.status(500).json({ message: status.error });
                    }
                    status.videos = 'success';
                    status.shorts = 'success';
                    console.log('YouTube data sync completed successfully.');
                    res.json({ message: 'YouTube data synced successfully!', status });
                });
            });
        });

    } catch (error) {
        console.error('An error occurred during YouTube sync:', error);
        status.error = error.message || 'An unknown error occurred.';
        res.status(500).json({ message: status.error, status });
    }
});

// Helper to fetch JSON from a URL
function fetchJson(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    try {
                        resolve(JSON.parse(data));
                    } catch (e) {
                        console.error(`JSON parsing error for URL: ${url}`, e);
                        reject(new Error(`Failed to parse JSON from ${url}: ${e.message}`));
                    }
                } else {
                    console.error(`HTTP Error for URL: ${url}, Status: ${res.statusCode}, Data: ${data}`);
                    reject(new Error(`HTTP error ${res.statusCode} for ${url}: ${data}`));
                }
            });
        }).on('error', (err) => {
            console.error(`Network error for URL: ${url}`, err);
            reject(new Error(`Network error for ${url}: ${err.message}`));
        });
    });
}


// --- Dashboard & Content Endpoints ---

function promisifyDbGet(query, params) {
    return new Promise((resolve, reject) => {
        db.get(query, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

function promisifyDbAll(query, params) {
    return new Promise((resolve, reject) => {
        db.all(query, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

app.get('/api/dashboard', authenticateToken, async (req, res) => {
    console.log('[server.js] /api/dashboard endpoint hit.');
    const dashboardData = {};
    const promises = [];

    promises.push(promisifyDbGet("SELECT subscribers_count FROM channel_stats WHERE id = 1")
        .then(r => { dashboardData.subscribers_count = r ? r.subscribers_count : 0; }));

    promises.push(promisifyDbGet("SELECT COUNT(*) as count FROM youtube_content WHERE type = 'video'")
        .then(r => { dashboardData.total_videos = r.count; }));

    promises.push(promisifyDbGet("SELECT COUNT(*) as count FROM youtube_content WHERE type = 'short'")
        .then(r => { dashboardData.total_shorts = r.count; }));

    promises.push(promisifyDbGet("SELECT SUM(views) as total FROM youtube_content")
        .then(r => { dashboardData.total_views = r.total; }));

    promises.push(promisifyDbGet("SELECT SUM(likes) as total FROM youtube_content")
        .then(r => { dashboardData.total_likes = r.total; }));

    promises.push(promisifyDbAll("SELECT views, type FROM youtube_content")
        .then(rows => {
            dashboardData.video_categories = { 'Emerging': 0, 'Growing': 0, 'Popular': 0, 'Trending': 0, 'Viral': 0 };
            dashboardData.shorts_categories = { 'Emerging': 0, 'Growing': 0, 'Popular': 0, 'Trending': 0, 'Viral': 0 };
            if (rows) {
                rows.forEach(row => {
                    const category = getCategory(row.views);
                    if (row.type === 'video') dashboardData.video_categories[category]++;
                    else dashboardData.shorts_categories[category]++;
                });
            }
        }));

    try {
        await Promise.all(promises);
        console.log('[API/dashboard] Dashboard data fetched:', dashboardData);
        res.json(dashboardData);
    } catch (err) {
        console.error('Error fetching dashboard data:', err);
        res.status(500).json({ message: "Error fetching dashboard data." });
    }
});

function getCategory(views) {
    if (views <= 1000) return 'Emerging';
    if (views <= 2500) return 'Growing';
    if (views <= 5000) return 'Popular';
    if (views <= 10000) return 'Trending';
    return 'Viral';
}

app.get('/api/content', authenticateToken, (req, res) => {
    const { type, sortBy, sortDirection, category, generalFilter, page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;
    let whereClauses = [];
    let params = [];

    if (type && type !== 'both') {
        whereClauses.push("type = ?");
        params.push(type);
    }

    if (category && category !== 'all') {
        const range = getCategoryRange(category);
        whereClauses.push("views BETWEEN ? AND ?");
        params.push(range.min, range.max);
    }
    
    if (generalFilter === 'favorites') {
        whereClauses.push(`id IN (SELECT video_id FROM favorites WHERE user_id = ?)`);
        params.push(req.user.id);
    }

    const whereString = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
    const orderBy = `ORDER BY ${sortBy} ${sortDirection}`;
    
    const countQuery = `SELECT COUNT(*) as totalCount FROM youtube_content ${whereString}`;
    const contentQuery = `SELECT *, (SELECT 1 FROM favorites WHERE user_id = ? AND video_id = youtube_content.id) as is_favorited FROM youtube_content ${whereString} ${orderBy} LIMIT ? OFFSET ?`;
    
    db.get(countQuery, params, (err, row) => {
        if (err) return res.status(500).json({ message: "Error counting content." });
        const totalCount = row.totalCount;
        console.log(`[API/content] Received params: type=${type}, sortBy=${sortBy}, sortDirection=${sortDirection}, category=${category}, generalFilter=${generalFilter}, page=${page}, limit=${limit}`);
        console.log(`[API/content] totalCount from DB: ${totalCount}`);
        db.all(contentQuery, [req.user.id, ...params, limit, offset], (err, content) => {
            if (err) {
                console.error('Error fetching content:', err);
                return res.status(500).json({ message: "Error fetching content." });
            }
            console.log(`[API/content] Returning ${content.length} items for page ${page} of ${totalCount} total.`);
            res.json({ content, totalCount });
        });
    });
});

app.get('/api/search', authenticateToken, (req, res) => {
    const { term, page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;
    const searchTerm = `%${term}%`;

    const countQuery = `SELECT COUNT(*) as totalCount FROM youtube_content WHERE title LIKE ?`;
    const searchQuery = `SELECT *, (SELECT 1 FROM favorites WHERE user_id = ? AND video_id = youtube_content.id) as is_favorited FROM youtube_content WHERE title LIKE ? ORDER BY published_at DESC LIMIT ? OFFSET ?`;

    db.get(countQuery, [searchTerm], (err, row) => {
        if (err) return res.status(500).json({ message: "Error counting search results." });
        const totalCount = row.totalCount;
        db.all(searchQuery, [req.user.id, searchTerm, limit, offset], (err, content) => {
            if (err) return res.status(500).json({ message: "Error fetching search results." });
            res.json({ content, totalCount });
        });
    });
});


function getCategoryRange(category) {
    switch (category) {
        case 'Emerging': return { min: 0, max: 1000 };
        case 'Growing': return { min: 1001, max: 2500 };
        case 'Popular': return { min: 2501, max: 5000 };
        case 'Trending': return { min: 5001, max: 10000 };
        case 'Viral': return { min: 10001, max: 999999999 };
        default: return { min: 0, max: 999999999 };
    }
}

app.get('/api/last-updated', authenticateToken, (req, res) => {
    db.get("SELECT last_updated FROM channel_stats WHERE id = 1", (err, row) => {
        if (err || !row) return res.status(500).json({ message: "Could not retrieve last updated time." });
        res.json({ last_updated: row.last_updated });
    });
});

// --- Favorites ---
app.post('/api/favorites', authenticateToken, (req, res) => {
    const { videoId } = req.body;
    db.run("INSERT INTO favorites (user_id, video_id) VALUES (?, ?)", [req.user.id, videoId], (err) => {
        if (err) return res.status(500).json({ message: "Could not add favorite." });
        res.sendStatus(201);
    });
});

app.delete('/api/favorites/:videoId', authenticateToken, (req, res) => {
    const { videoId } = req.params;
    db.run("DELETE FROM favorites WHERE user_id = ? AND video_id = ?", [req.user.id, videoId], (err) => {
        if (err) return res.status(500).json({ message: "Could not remove favorite." });
        res.sendStatus(204);
    });
});

// --- Online Users ---
app.get('/api/online-users', authenticateToken, (req, res) => {
    db.all("SELECT username FROM online_users ORDER BY username", (err, users) => {
        if (err) return res.status(500).json({ message: "Error fetching online users." });
        res.json(users);
    });
});

// --- User Settings ---
app.post('/api/user/change-password', authenticateToken, async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    
    db.get('SELECT password FROM users WHERE id = ?', [req.user.id], async (err, user) => {
        if (err || !user) return res.status(404).json({ message: 'User not found.' });

        const match = await bcrypt.compare(currentPassword, user.password);
        if (!match) return res.status(401).json({ message: 'Incorrect current password.' });

        const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);
        db.run('UPDATE users SET password = ?, temp_password_active = 0 WHERE id = ?', [hashedNewPassword, req.user.id], (err) => {
            if (err) return res.status(500).json({ message: 'Error updating password.' });
            res.json({ message: 'Password changed successfully!' });
        });
    });
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
