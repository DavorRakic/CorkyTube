## 📺 CorkyTube

**CorkyTube** is a lightweight video listing web app built with Node.js and SQLite. It functions as a browser for a specific YouTube channel, syncing video data on demand using the YouTube Data API.

---

### 🚀 Live Demo

Check it out live on [CorkyTube on Render](https://corkytube.onrender.com)

---

### 📦 Features

- 🗂️ Displays video thumbnails, titles, views, and likes
- 🔍 Search by video title
- 🕒 Sort by date
- 🔄 Syncs with a specific YouTube channel via API
- 🧠 SQLite-backed permanent storage
- 🛠️ Deployed on Render with persistent disk

---

### 🧰 Tech Stack

- **Backend**: Node.js + Express
- **Database**: SQLite
- **Frontend**: HTML/CSS (served via Express)
- **Hosting**: Render.com
- **API**: YouTube Data API v3

---

### 📁 Project Structure

```
CorkyTube/
├── public/           # Static assets
├── seed/             # Preloaded SQLite database
├── server.js         # Main server logic
├── .render.yaml      # Render deployment config
├── package.json      # Dependencies and scripts
```

---

### 🔄 YouTube Channel Sync

CorkyTube is designed to sync video data from **one specific YouTube channel** using:

- `GOOGLE_API_KEY`: Your YouTube Data API key
- `YOUTUBE_CHANNEL_ID`: The target channel's ID

These are set as **environment variables** in Render. On-demand sync fetches the latest videos and updates the SQLite database.

---

### 🧪 Local Development

1. Clone the repo:
   ```bash
   git clone https://github.com/DavorRakic/CorkyTube.git
   cd CorkyTube
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set environment variables:
   ```bash
   export GOOGLE_API_KEY=your_api_key
   export YOUTUBE_CHANNEL_ID=your_channel_id
   ```

4. Start the server:
   ```bash
   node server.js
   ```

5. Visit `http://localhost:3000` in your browser.

---

### 🗄️ Database Setup

The app uses a preloaded SQLite database located in `/seed/corkytube.db`. On Render, this file is copied to the permanent disk (`/var/data/corkytube.db`) during startup.

---

### 🛠️ Deployment on Render

1. Mount a permanent disk at `/var/data`
2. Add environment variables:
   - `GOOGLE_API_KEY`
   - `YOUTUBE_CHANNEL_ID`
3. Use `.render.yaml` to configure build and startup:
   ```yaml
   startCommand: |
     if [ ! -f /var/data/corkytube.db ]; then
       cp ./seed/corkytube.db /var/data/corkytube.db
     fi
     node server.js
   ```
---

### 🤝 Contributing

Contributions are welcome! If you'd like to improve CorkyTube, feel free to:

- Fork the repo
- Create a new branch
- Submit a pull request with clear descriptions

Bug reports, feature requests, and feedback are also appreciated via GitHub Issues.

---

### 📄 License

This project is licensed under the **MIT License**. You’re free to use, modify, and distribute it with proper attribution.

---

### 📬 Contact

Built by [Davor Rakic](https://github.com/DavorRakic) — feel free to fork, contribute, or reach out!
