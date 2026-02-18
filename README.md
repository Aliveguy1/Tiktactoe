# Tic Tac Toe - Live Multiplayer Game

A real-time multiplayer Tic Tac Toe game built with Node.js, Express, and Socket.IO. Play with friends from different devices and track wins on a persistent leaderboard.

## Features

- 🎮 **Live Multiplayer**: Create or join game rooms
- ⚡ **Real-time Sync**: Instant move synchronization using Socket.IO
- 🏆 **Persistent Leaderboard**: Track wins across sessions
- 📱 **Responsive Design**: Works on desktop and mobile
- 🎨 **Beautiful UI**: Modern gradient design with smooth animations

## Installation

### Prerequisites
- Node.js 14+
- npm

### Setup

```bash
# Clone the repository
git clone https://github.com/YOUR-USERNAME/tictactoe-multiplayer.git
cd tictactoe-multiplayer

# Install dependencies
npm install

# Start the server
npm start
```

The game will be available at `http://localhost:3000`

## How to Play

1. Open http://localhost:3000
2. Enter your name
3. **Create Room** to host a game or **Join** an existing room
4. Player 1 clicks "Start Game" when both players are ready
5. Take turns clicking cells on the board
6. First to get 3 in a row wins!
7. Leaderboard automatically tracks all wins

## For Other Devices

Find your machine's IP address:
```bash
ipconfig
```
Look for "IPv4 Address" and access: `http://YOUR-IP:3000`

## Deployment on Render

1. Push code to GitHub
2. Sign up at https://render.com
3. Create new Web Service
4. Connect your GitHub repository
5. Set start command: `npm start`
6. Your game is live!

## Files

- `index.html` - Game UI and client-side logic
- `server.js` - Node.js server with Socket.IO
- `package.json` - Dependencies and scripts
- `leaderboard.json` - Persistent leaderboard data

## License

ISC
