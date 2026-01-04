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
    origin: "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});

// Game state
let players = {};

io.on('connection', (socket) => {
  console.log('Player connected:', socket.id);
  
  // Add new player with random dog
  const dogTypes = ['kenzo', 'olive', 'jude'];
  const randomDog = dogTypes[Math.floor(Math.random() * dogTypes.length)];

  players[socket.id] = {
    id: socket.id,
    x: 100,
    y: 100,
    rotation: 0,
    dogType: randomDog
  };
  
  socket.emit('current-players', players);
  socket.broadcast.emit('player-joined', players[socket.id]);
  
  socket.on('player-move', (data) => {
  if (players[socket.id]) {
    players[socket.id].x = data.x;
    players[socket.id].y = data.y;
    players[socket.id].rotation = data.rotation;
  }
  socket.broadcast.emit('player-moved', players[socket.id]);
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