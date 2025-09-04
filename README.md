# 🎬 Watch Together - Synced

A real-time synchronized video watching application built with Node.js, Express, and Socket.IO. Watch YouTube videos together with friends in perfect sync!

## ✨ Features

- 🔄 **Real-time synchronization** - All viewers see the same thing at the same time
- 👥 **Live user counter** - See how many people are watching
- ⚡ **Instant controls** - Play, pause, and seek for everyone
- 📱 **Responsive design** - Works on desktop and mobile
- 🌐 **Easy deployment** - Ready for Vercel deployment
- 🎯 **Network delay compensation** - Smart sync even with latency

## 🚀 Quick Start

### Local Development

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start the server:**
   ```bash
   npm start
   ```

3. **Open in browser:**
   ```
   http://localhost:3000
   ```

### 📦 Deploy to Vercel

Vercel's serverless functions do not keep long-lived WebSocket connections open, so host the Socket.IO backend elsewhere and deploy only the static frontend on Vercel.

1. **Install Vercel CLI:**
   ```bash
   npm i -g vercel
   ```

2. **Configure frontend to point to your backend:**
   In `public/index.html`, set:
   ```html
   <script>
     window.SOCKET_SERVER_URL = "https://your-backend.example.com";
     window.SOCKET_IO_PATH = "/socket.io";
   </script>
   ```

3. **Deploy the `public/` folder:**
   ```bash
   vercel public --prod
   ```

4. **Backend security (recommended):**
   - Set `ALLOWED_ORIGIN` on the backend to your Vercel domain(s), comma-separated
   - Optionally set `SOCKET_IO_PATH` if customized

## 🎮 How to Use

1. **Load a video**: Paste any YouTube URL and click "Load Video"
2. **Control playback**: Use Play/Pause buttons - everyone sees the changes
3. **Jump to time**: Enter seconds and click "Seek To Time"
4. **Watch together**: Share your URL with friends!

## 🛠️ Tech Stack

- **Backend**: Node.js + Express
- **Real-time**: Socket.IO
- **Frontend**: Vanilla JavaScript + YouTube API
- **Styling**: CSS3 with gradients and animations
- **Deployment**: Vercel-ready

Happy watching! 🍿
