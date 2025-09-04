const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.ALLOWED_ORIGIN ? process.env.ALLOWED_ORIGIN.split(",") : "*",
    methods: ["GET", "POST"],
    credentials: true
  },
  path: process.env.SOCKET_IO_PATH || "/socket.io"
});

// Store current video state with timestamp
let currentVideo = {
  videoId: "",
  loaded: false,
  isPlaying: false,
  currentTime: 0,
  lastUpdate: 0
};

// Track connected users
const connectedUsers = new Set();

// Serve static files
app.use(express.static('public'));

// Serve main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Handle socket connections
io.on('connection', (socket) => {
  const userId = socket.id;
  connectedUsers.add(userId);
  const userCount = connectedUsers.size;
  
  console.log(`User connected: ${userId}`);
  console.log(`Total users: ${userCount}`);
  
  // Send current video to newly connected user
  if (currentVideo.loaded) {
    socket.emit('loadVideo', currentVideo.videoId);
    // If video is currently playing, sync the time
    if (currentVideo.isPlaying) {
      const timeElapsed = (Date.now() - currentVideo.lastUpdate) / 1000;
      const currentTime = currentVideo.currentTime + timeElapsed;
      socket.emit('videoSync', {
        action: 'play',
        time: currentTime,
        timestamp: Date.now()
      });
    }
  }
  
  // Broadcast updated user count to all clients
  io.emit('userCount', { count: userCount });

  // Handle load video
  socket.on('loadVideo', (videoId) => {
    currentVideo.videoId = videoId;
    currentVideo.loaded = true;
    currentVideo.isPlaying = false;
    currentVideo.currentTime = 0;
    currentVideo.lastUpdate = Date.now();
    
    io.emit('loadVideo', videoId);
    console.log(`Video loaded: ${videoId}`);
  });

  // Handle video sync (play/pause/seek with timestamp)
  socket.on('videoSync', (data) => {
    currentVideo.currentTime = data.time;
    currentVideo.lastUpdate = Date.now();
    
    if (data.action === 'play') {
      currentVideo.isPlaying = true;
    } else if (data.action === 'pause') {
      currentVideo.isPlaying = false;
    } else if (data.action === 'seek') {
      currentVideo.isPlaying = false; // Usually seeking pauses
    }
    
    // Broadcast to all clients
    io.emit('videoSync', data);
    console.log(`Video sync: ${data.action} at ${data.time.toFixed(2)}s`);
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    connectedUsers.delete(userId);
    const userCount = connectedUsers.size;
    
    console.log(`User disconnected: ${userId}`);
    console.log(`Total users: ${userCount}`);
    
    // Broadcast updated user count to remaining clients
    io.emit('userCount', { count: userCount });
  });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌐 Access at: http://localhost:${PORT}`);
});
