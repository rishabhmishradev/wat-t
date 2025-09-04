// Allow overriding the Socket.IO server when deploying frontend separately (e.g., Vercel)
// Provide via: window.SOCKET_SERVER_URL (string) and optional window.SOCKET_IO_PATH
const SOCKET_IO_PATH = window.SOCKET_IO_PATH || '/socket.io';
const SOCKET_SERVER_URL = (typeof window !== 'undefined' && window.SOCKET_SERVER_URL) 
  || window.localStorage.getItem('SOCKET_SERVER_URL') 
  || undefined; // fall back to same-origin when undefined

const socket = SOCKET_SERVER_URL
  ? io(SOCKET_SERVER_URL, { path: SOCKET_IO_PATH, transports: ['websocket', 'polling'], withCredentials: true })
  : io('/', { path: SOCKET_IO_PATH, transports: ['websocket', 'polling'], withCredentials: true });
let player;
let isPlayerReady = false;
let pendingVideoId = null;

// YouTube API ready callback - MUST be global
window.onYouTubeIframeAPIReady = function() {
  console.log('✅ YouTube API loaded successfully');
  
  // If there's a pending video, load it now
  if (pendingVideoId) {
    console.log('Loading pending video:', pendingVideoId);
    initializePlayer(pendingVideoId);
    pendingVideoId = null;
  }
};

// Load YouTube API immediately
function loadYouTubeAPI() {
  // Check if already loaded
  if (window.YT && window.YT.Player) {
    console.log('YouTube API already loaded');
    window.onYouTubeIframeAPIReady();
    return;
  }
  
  console.log('Loading YouTube API...');
  const tag = document.createElement('script');
  tag.src = "https://www.youtube.com/iframe_api";
  tag.onload = () => console.log('YouTube API script loaded');
  tag.onerror = () => console.error('Failed to load YouTube API');
  
  const firstScriptTag = document.getElementsByTagName('script')[0];
  firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
}

// Load video function
function loadVideo() {
  let url = document.getElementById("videoUrl").value.trim();
  let videoId = extractVideoID(url);

  if (videoId) {
    console.log('Loading video ID:', videoId);
    socket.emit("loadVideo", videoId);
    document.getElementById("videoUrl").value = '';
    showNotification('🚀 Loading video...', 'info');
  } else {
    showNotification('❌ Invalid YouTube URL! Please paste a valid YouTube video URL.', 'error');
  }
}

// Receive load video from server
socket.on("loadVideo", function(videoId) {
  console.log('Received loadVideo event:', videoId);
  
  // Clean the video ID (remove query parameters)
  const cleanVideoId = videoId.split('?')[0].split('&')[0];
  console.log('Clean video ID:', cleanVideoId);
  
  // Check if YouTube API is ready
  if (window.YT && window.YT.Player) {
    console.log('YouTube API ready, initializing player');
    initializePlayer(cleanVideoId);
  } else {
    console.log('YouTube API not ready, storing video ID');
    pendingVideoId = cleanVideoId;
    loadYouTubeAPI(); // Try loading API again
  }
});

// Initialize YouTube player
function initializePlayer(videoId) {
  console.log('Initializing player with video ID:', videoId);
  
  // Destroy existing player
  if (player) {
    try {
      player.destroy();
      console.log('Previous player destroyed');
    } catch (e) {
      console.warn('Error destroying previous player:', e);
    }
  }
  
  // Get responsive dimensions
  const containerWidth = Math.min(800, window.innerWidth - 40);
  const containerHeight = Math.round(containerWidth * 0.5625);
  
  console.log(`Creating player: ${containerWidth}x${containerHeight}`);
  
  try {
    player = new YT.Player('player', {
      videoId: videoId,
      width: containerWidth,
      height: containerHeight,
      playerVars: {
        'enablejsapi': 1,
        'origin': window.location.origin,
        'rel': 0,
        'showinfo': 0,
        'controls': 1,
        'modestbranding': 1,
        'iv_load_policy': 3
      },
      events: {
        'onReady': function(event) {
          isPlayerReady = true;
          console.log('✅ Player ready for video:', videoId);
          showNotification('✅ Video loaded successfully!', 'success');
        },
        'onStateChange': function(event) {
          console.log('Player state changed:', event.data);
          
          // Prevent infinite loop
          if (!socket.receivingSync) {
            if (event.data == YT.PlayerState.PLAYING) {
              const currentTime = player.getCurrentTime();
              console.log('User played video at:', currentTime);
              socket.emit("videoSync", {
                action: "play",
                time: currentTime,
                timestamp: Date.now()
              });
            } else if (event.data == YT.PlayerState.PAUSED) {
              const currentTime = player.getCurrentTime();
              console.log('User paused video at:', currentTime);
              socket.emit("videoSync", {
                action: "pause",
                time: currentTime,
                timestamp: Date.now()
              });
            }
          }
        },
        'onError': function(event) {
          console.error('YouTube player error:', event.data);
          let errorMessage = 'Error loading video';
          
          switch(event.data) {
            case 2:
              errorMessage = 'Invalid video ID';
              break;
            case 5:
              errorMessage = 'Video cannot be played in HTML5';
              break;
            case 100:
              errorMessage = 'Video not found or private';
              break;
            case 101:
            case 150:
              errorMessage = 'Video not allowed to be embedded';
              break;
          }
          
          showNotification(`❌ ${errorMessage}. Please try another URL.`, 'error');
        }
      }
    });
  } catch (error) {
    console.error('Error creating YouTube player:', error);
    showNotification('❌ Failed to create video player', 'error');
  }
}

// Manual controls
function controlVideo(action) {
  if (!isPlayerReady) {
    showNotification('⏳ Player not ready yet! Please wait...', 'warning');
    return;
  }
  
  try {
    const currentTime = player.getCurrentTime();
    console.log(`Manual ${action} at time:`, currentTime);
    
    socket.emit("videoSync", {
      action: action,
      time: currentTime,
      timestamp: Date.now()
    });
    
    const actionText = action === 'play' ? '▶️ Playing' : '⏸️ Paused';
    showNotification(`${actionText} video for everyone`, 'info');
  } catch (error) {
    console.error('Error controlling video:', error);
    showNotification('❌ Error controlling video', 'error');
  }
}

// Sync video with timestamp
socket.on("videoSync", function(data) {
  if (!isPlayerReady) {
    console.log('Player not ready for sync');
    return;
  }
  
  console.log('Received video sync:', data);
  socket.receivingSync = true;
  
  try {
    const networkDelay = (Date.now() - data.timestamp) / 1000;
    let targetTime = data.time;
    
    if (data.action === "play") {
      targetTime += networkDelay;
      console.log('Syncing play at:', targetTime);
      player.seekTo(targetTime, true);
      player.playVideo();
    } else if (data.action === "pause") {
      console.log('Syncing pause at:', data.time);
      player.seekTo(data.time, true);
      player.pauseVideo();
    } else if (data.action === "seek") {
      console.log('Syncing seek to:', data.time);
      player.seekTo(data.time, true);
    }
  } catch (error) {
    console.error('Error syncing video:', error);
  }
  
  // Reset sync flag
  setTimeout(() => {
    socket.receivingSync = false;
  }, 1000);
});

// Seek function
function seekVideo() {
  const seekTime = parseFloat(document.getElementById("seekTime").value);
  if (isNaN(seekTime) || seekTime < 0) {
    showNotification('⚠️ Please enter a valid time in seconds!', 'warning');
    return;
  }
  
  if (!isPlayerReady) {
    showNotification('⏳ Player not ready yet! Please wait...', 'warning');
    return;
  }
  
  socket.emit("videoSync", {
    action: "seek",
    time: seekTime,
    timestamp: Date.now()
  });
  
  document.getElementById("seekTime").value = '';
  showNotification(`🎯 Jumped to ${seekTime}s for everyone`, 'info');
}

// Get current time
function getCurrentTime() {
  if (player && isPlayerReady) {
    try {
      const currentTime = player.getCurrentTime();
      const minutes = Math.floor(currentTime / 60);
      const seconds = Math.floor(currentTime % 60);
      const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;
      
      console.log("Current time:", currentTime);
      showNotification(`🕒 Current time: ${timeStr} (${currentTime.toFixed(1)}s)`, 'info');
    } catch (error) {
      console.error('Error getting current time:', error);
      showNotification('❌ Error getting current time', 'error');
    }
  } else {
    showNotification('⏳ Player not ready yet!', 'warning');
  }
}

// Extract YouTube Video ID
function extractVideoID(url) {
  console.log('Extracting video ID from:', url);
  
  const patterns = [
    /(?:youtube\.com\/watch\?v=)([^&\s]+)/,
    /(?:youtube\.com\/embed\/)([^&\s]+)/,
    /(?:youtu\.be\/)([^&\s]+)/,
    /(?:youtube\.com\/v\/)([^&\s]+)/,
    /(?:youtube\.com\/live\/)([^&\s]+)/
  ];
  
  for (let pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      console.log('Extracted video ID:', match[1]);
      return match[1];
    }
  }
  
  console.log('No video ID found');
  return null;
}

// Notification system
function showNotification(message, type = 'info') {
  const existingNotification = document.querySelector('.notification');
  if (existingNotification) {
    existingNotification.remove();
  }
  
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.textContent = message;
  
  const styles = {
    position: 'fixed',
    top: '20px',
    right: '20px',
    padding: '15px 20px',
    borderRadius: '10px',
    color: 'white',
    fontSize: '14px',
    fontWeight: '500',
    zIndex: '10000',
    maxWidth: '300px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
    transition: 'all 0.3s ease',
    transform: 'translateX(100%)'
  };
  
  const typeColors = {
    success: '#28a745',
    error: '#dc3545',
    warning: '#ffc107',
    info: '#17a2b8'
  };
  
  Object.assign(notification.style, styles);
  notification.style.backgroundColor = typeColors[type] || typeColors.info;
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.style.transform = 'translateX(0)';
  }, 10);
  
  setTimeout(() => {
    if (notification.parentNode) {
      notification.style.transform = 'translateX(100%)';
      setTimeout(() => {
        if (notification.parentNode) {
          notification.remove();
        }
      }, 300);
    }
  }, 3000);
}

// Event listeners
document.addEventListener('DOMContentLoaded', function() {
  console.log('DOM loaded, setting up event listeners');
  
  const videoUrlInput = document.getElementById('videoUrl');
  const seekTimeInput = document.getElementById('seekTime');
  
  if (videoUrlInput) {
    videoUrlInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        loadVideo();
      }
    });
  }
  
  if (seekTimeInput) {
    seekTimeInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        seekVideo();
      }
    });
  }
  
  // Load YouTube API
  loadYouTubeAPI();
});

// Socket events
socket.on('connect', function() {
  console.log('Connected to server');
  showNotification('🟢 Connected to server!', 'success');
});

socket.on('disconnect', function() {
  console.log('Disconnected from server');
  showNotification('🔴 Disconnected from server', 'error');
});

socket.on('connect_error', function(error) {
  console.error('Connection error:', error);
  showNotification('❌ Connection failed. Please refresh the page.', 'error');
});

socket.on('userCount', function(data) {
  console.log('User count:', data.count);
  const userCountText = document.getElementById('userCountText');
  
  if (userCountText) {
    const count = data.count;
    
    if (count === 0) {
      userCountText.textContent = 'No one watching';
    } else if (count === 1) {
      userCountText.textContent = '1 person watching';
    } else {
      userCountText.textContent = `${count} people watching`;
    }
  }
});

// Handle window resize
window.addEventListener('resize', function() {
  if (player && isPlayerReady) {
    try {
      const containerWidth = Math.min(800, window.innerWidth - 40);
      const containerHeight = Math.round(containerWidth * 0.5625);
      player.setSize(containerWidth, containerHeight);
    } catch (error) {
      console.warn('Could not resize player:', error);
    }
  }
});

// Debug function
window.debugPlayer = function() {
  console.log('=== PLAYER DEBUG ===');
  console.log('YT available:', !!window.YT);
  console.log('YT.Player available:', !!(window.YT && window.YT.Player));
  console.log('Player instance:', !!player);
  console.log('Player ready:', isPlayerReady);
  console.log('Pending video:', pendingVideoId);
};