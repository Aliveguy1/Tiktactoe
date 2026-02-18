const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Serve static files
app.use(express.static(path.join(__dirname, '.')));

// Store game rooms and leaderboard
const rooms = {};
const leaderboardFile = path.join(__dirname, 'leaderboard.json');

// Load leaderboard from file
function loadLeaderboard() {
  try {
    if (fs.existsSync(leaderboardFile)) {
      return JSON.parse(fs.readFileSync(leaderboardFile, 'utf8'));
    }
  } catch (err) {
    console.error('Error loading leaderboard:', err);
  }
  return {};
}

// Save leaderboard to file
function saveLeaderboard(leaderboard) {
  try {
    fs.writeFileSync(leaderboardFile, JSON.stringify(leaderboard, null, 2));
  } catch (err) {
    console.error('Error saving leaderboard:', err);
  }
}

let leaderboard = loadLeaderboard();

// Socket.io connection handler
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Get all available rooms
  socket.on('get_rooms', () => {
    const availableRooms = Object.keys(rooms).map(roomId => ({
      id: roomId,
      player1: rooms[roomId].player1,
      status: rooms[roomId].status
    }));
    socket.emit('rooms_list', availableRooms);
  });

  // Create a new room
  socket.on('create_room', (data) => {
    const roomId = Math.random().toString(36).substr(2, 9);
    rooms[roomId] = {
      id: roomId,
      player1: data.playerName,
      player1Id: socket.id,
      player2: null,
      player2Id: null,
      spectators: [],
      board: ['', '', '', '', '', '', '', '', ''],
      currentPlayer: 'X',
      status: 'waiting',
      gameActive: false
    };
    
    socket.join(roomId);
    socket.emit('room_created', { roomId, rooms: rooms[roomId] });
    io.emit('rooms_updated', Object.keys(rooms).map(id => ({
      id: id,
      player1: rooms[id].player1,
      status: rooms[id].status,
      spectatorCount: rooms[id].spectators.length
    })));
  });

  // Join a room
  socket.on('join_room', (data) => {
    const room = rooms[data.roomId];
    if (room && !room.player2) {
      room.player2 = data.playerName;
      room.player2Id = socket.id;
      room.status = 'ready';
      
      socket.join(data.roomId);
      io.to(data.roomId).emit('game_updated', room);
      io.emit('rooms_updated', Object.keys(rooms).map(id => ({
        id: id,
        player1: rooms[id].player1,
        status: rooms[id].status,
        spectatorCount: rooms[id].spectators.length
      })));
    } else {
      socket.emit('join_failed', { message: 'Room not available' });
    }
  });

  // Join as spectator
  socket.on('join_as_spectator', (data) => {
    const room = rooms[data.roomId];
    if (room && room.spectators.length < 2) {
      room.spectators.push({
        id: socket.id,
        name: data.playerName
      });
      socket.join(data.roomId);
      io.to(data.roomId).emit('game_updated', room);
      io.emit('rooms_updated', Object.keys(rooms).map(id => ({
        id: id,
        player1: rooms[id].player1,
        status: rooms[id].status,
        spectatorCount: rooms[id].spectators.length
      })));
    } else {
      socket.emit('join_failed', { message: 'Room is full or spectators are maxed out' });
    }
  });

  // Start game
  socket.on('start_game', (data) => {
    const room = rooms[data.roomId];
    if (room) {
      room.gameActive = true;
      room.board = ['', '', '', '', '', '', '', '', ''];
      room.currentPlayer = 'X';
      room.status = 'playing';
      io.to(data.roomId).emit('game_updated', room);
    }
  });

  // Make a move
  socket.on('make_move', (data) => {
    const room = rooms[data.roomId];
    if (room && room.gameActive) {
      const index = data.index;
      if (room.board[index] === '') {
        room.board[index] = room.currentPlayer;
        
        // Check for winner
        const winner = checkWinner(room.board);
        if (winner) {
          const winnerName = winner === 'X' ? room.player1 : room.player2;
          room.gameActive = false;
          room.status = 'finished';
          updateLeaderboard(winnerName);
          io.to(data.roomId).emit('game_updated', room);
          io.to(data.roomId).emit('game_won', { 
            winner: winnerName, 
            symbol: winner,
            leaderboard: leaderboard 
          });
        } else if (room.board.every(cell => cell !== '')) {
          room.gameActive = false;
          room.status = 'finished';
          io.to(data.roomId).emit('game_updated', room);
          io.to(data.roomId).emit('game_draw', { leaderboard: leaderboard });
        } else {
          room.currentPlayer = room.currentPlayer === 'X' ? 'O' : 'X';
          io.to(data.roomId).emit('game_updated', room);
        }
      }
    }
  });

  // Reset board
  socket.on('reset_board', (data) => {
    const room = rooms[data.roomId];
    if (room) {
      room.board = ['', '', '', '', '', '', '', '', ''];
      room.currentPlayer = 'X';
      room.gameActive = false;
      room.status = 'ready';
      io.to(data.roomId).emit('game_updated', room);
    }
  });

  // Get leaderboard
  socket.on('get_leaderboard', () => {
    socket.emit('leaderboard_updated', leaderboard);
  });

  // Clear leaderboard
  socket.on('clear_leaderboard', () => {
    leaderboard = {};
    saveLeaderboard(leaderboard);
    io.emit('leaderboard_updated', leaderboard);
  });

  // Chat message
  socket.on('send_chat', (data) => {
    const room = rooms[data.roomId];
    if (room) {
      const isPlayer1 = room.player1Id === socket.id;
      io.to(data.roomId).emit('chat_message', {
        playerName: data.playerName,
        message: data.message,
        isCurrentPlayer: isPlayer1
      });
    }
  });

  // Disconnect
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    
    // Remove player from rooms and clean up empty rooms
    for (let roomId in rooms) {
      const room = rooms[roomId];
      if (room.player1Id === socket.id || room.player2Id === socket.id) {
        io.to(roomId).emit('player_disconnected', { message: 'A player has disconnected' });
        delete rooms[roomId];
      } else {
        // Remove spectators
        room.spectators = room.spectators.filter(s => s.id !== socket.id);
        if (room.spectators.length > 0 || room.player1Id || room.player2Id) {
          io.to(roomId).emit('game_updated', room);
        }
      }
    }
    
    io.emit('rooms_updated', Object.keys(rooms).map(id => ({
      id: id,
      player1: rooms[id].player1,
      status: rooms[id].status,
      spectatorCount: rooms[id].spectators.length
    })));
  });
});

// Helper function to check winner
function checkWinner(board) {
  const winPatterns = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6]
  ];
  
  for (let pattern of winPatterns) {
    const [a, b, c] = pattern;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a];
    }
  }
  return null;
}

// Update leaderboard
function updateLeaderboard(winner) {
  if (!leaderboard[winner]) {
    leaderboard[winner] = 0;
  }
  leaderboard[winner]++;
  saveLeaderboard(leaderboard);
  io.emit('leaderboard_updated', leaderboard);
}

const PORT = process.env.PORT || 8080;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Access from other devices: http://10.20.53.89:${PORT}`);
});
