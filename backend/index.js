const express = require('express');
console.log('Script started!');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "pit-crew-pups-5si7z8jja-claryssayuanwies-projects.vercel.app",
    methods: ["GET", "POST"]
  }
});

// Game state
let players = {};

io.on('connection', (socket) => {
  console.log('Player connected:', socket.id);
  
  // Don't initialize player here - wait for first player-move
  
  // Send existing players to new player
  socket.emit('current-players', players);
  
  socket.on('player-move', (data) => {
    // If player doesn't exist, create them
    if (!players[socket.id]) {
      players[socket.id] = {
        id: socket.id,
        x: data.x,
        y: data.y,
        rotation: data.rotation,
        dogType: data.dogType,
        name: data.name,
        lap: data.lap || 0
      };
      
      // Tell other players about the new player
      socket.broadcast.emit('player-joined', players[socket.id]);
    } else {
      // Update existing player
      players[socket.id].x = data.x;
      players[socket.id].y = data.y;
      players[socket.id].rotation = data.rotation;
      
      if (data.dogType) {
        players[socket.id].dogType = data.dogType;
      }
      if (data.name) {
        players[socket.id].name = data.name;
      }
      if (data.lap !== undefined) {
        players[socket.id].lap = data.lap;
      }
      
      // Broadcast update
      socket.broadcast.emit('player-moved', players[socket.id]);
    }
  });
  
  socket.on('disconnect', () => {
    console.log('Player disconnected:', socket.id);
    delete players[socket.id];
    io.emit('player-left', socket.id);
  });
});

const PORT = 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});