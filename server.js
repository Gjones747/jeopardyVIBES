const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

const games = {};

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function getPlayers(game) {
  return Object.values(game.players)
    .sort((a, b) => b.score - a.score)
    .map(p => ({ id: p.id, name: p.name, score: p.score }));
}

function serializeGame(game) {
  return {
    code: game.code,
    state: game.state,
    board: game.board,
    players: getPlayers(game),
    activeQuestion: game.activeQuestion,
    buzzOrder: game.buzzOrder.map(id => ({
      id,
      name: game.players[id]?.name || 'Unknown'
    }))
  };
}

function closeQuestion(game, markAnswered) {
  if (game.activeQuestion && markAnswered) {
    game.board.categories[game.activeQuestion.catIndex]
      .questions[game.activeQuestion.qIndex].answered = true;
  }
  game.activeQuestion = null;
  game.buzzOrder = [];
  game.state = 'playing';
  Object.values(game.players).forEach(p => p.canBuzz = false);
}

function getHostGame(socket) {
  const code = socket.data.gameCode;
  if (!code) return null;
  const game = games[code];
  if (!game) return null;
  if (game.host !== socket.id) return null;
  return game;
}

io.on('connection', (socket) => {
  // Host creates a new game with board data
  socket.on('create-game', (boardData, callback) => {
    let code;
    let attempts = 0;
    do { code = generateCode(); attempts++; } while (games[code] && attempts < 100);

    games[code] = {
      code,
      board: boardData,
      players: {},
      host: socket.id,
      activeQuestion: null,
      buzzOrder: [],
      state: 'lobby'
    };

    socket.join(code);
    socket.data.gameCode = code;
    socket.data.isHost = true;

    callback({ success: true, code });
  });

  // Board display connects to a room
  socket.on('join-board', (code, callback) => {
    const game = games[code];
    if (!game) return callback({ error: 'Game not found' });

    socket.join(code);
    socket.data.gameCode = code;
    socket.data.isBoard = true;

    callback({ success: true, game: serializeGame(game) });
  });

  // Player joins a game
  socket.on('join-game', ({ code, name }, callback) => {
    const game = games[code];
    if (!game) return callback({ error: 'Game not found' });
    if (!name?.trim()) return callback({ error: 'Name required' });
    if (game.state === 'lobby' || game.state === 'playing' || game.state === 'question-active') {
      // allow joining anytime
    }

    let playerName = name.trim().substring(0, 20);
    const existingNames = Object.values(game.players).map(p => p.name.toLowerCase());
    if (existingNames.includes(playerName.toLowerCase())) {
      playerName = playerName + Math.floor(Math.random() * 100);
    }

    game.players[socket.id] = { id: socket.id, name: playerName, score: 0, canBuzz: false };
    socket.join(code);
    socket.data.gameCode = code;
    socket.data.playerName = playerName;

    io.to(code).emit('players-update', getPlayers(game));
    callback({ success: true, name: playerName, game: serializeGame(game) });
  });

  // Host starts the game
  socket.on('start-game', () => {
    const game = getHostGame(socket);
    if (!game) return;
    game.state = 'playing';
    io.to(game.code).emit('game-started', { board: game.board });
  });

  // Host selects a question cell
  socket.on('select-question', ({ catIndex, qIndex, buzzTimeLimit, answerTimeLimit }) => {
    const game = getHostGame(socket);
    if (!game || game.state !== 'playing') return;

    const cat = game.board.categories[catIndex];
    const q = cat?.questions[qIndex];
    if (!q || q.answered) return;

    game.activeQuestion = {
      catIndex,
      qIndex,
      category: cat.name,
      clue: q.clue,
      answer: q.answer,
      value: q.value,
      dailyDouble: q.dailyDouble || false,
      buzzTimeLimit: Math.max(5, Math.min(120, parseInt(buzzTimeLimit) || 30)),
      answerTimeLimit: Math.max(5, Math.min(60, parseInt(answerTimeLimit) || 20)),
    };
    game.buzzOrder = [];
    game.state = 'question-active';
    Object.values(game.players).forEach(p => p.canBuzz = true);

    io.to(game.code).emit('question-active', game.activeQuestion);
  });

  // Player buzzes in
  socket.on('buzz-in', () => {
    const code = socket.data.gameCode;
    const game = games[code];
    if (!game || game.state !== 'question-active') return;

    const player = game.players[socket.id];
    if (!player || !player.canBuzz) return;
    if (game.buzzOrder.includes(socket.id)) return;

    game.buzzOrder.push(socket.id);

    io.to(code).emit('buzz-update', {
      buzzOrder: game.buzzOrder.map(id => ({ id, name: game.players[id]?.name || 'Unknown' })),
      firstBuzzerId: game.buzzOrder[0],
      firstBuzzerName: game.players[game.buzzOrder[0]]?.name
    });
  });

  // Host marks answer correct or incorrect
  socket.on('answer-result', ({ correct }) => {
    const game = getHostGame(socket);
    if (!game || !game.activeQuestion || game.buzzOrder.length === 0) return;

    const firstId = game.buzzOrder[0];
    const player = game.players[firstId];
    if (!player) return;

    const value = game.activeQuestion.value;

    if (correct) {
      player.score += value;
      const snapshot = {
        playerId: firstId,
        playerName: player.name,
        value,
        players: getPlayers(game)
      };
      closeQuestion(game, true);
      io.to(game.code).emit('answer-correct', snapshot);
      io.to(game.code).emit('question-closed');
    } else {
      player.score -= value;
      player.canBuzz = false;
      game.buzzOrder.shift();

      io.to(game.code).emit('answer-wrong', {
        playerId: firstId,
        playerName: player.name,
        value,
        players: getPlayers(game)
      });

      // If someone else already buzzed, immediately surface them as next
      if (game.buzzOrder.length > 0) {
        io.to(game.code).emit('buzz-update', {
          buzzOrder: game.buzzOrder.map(id => ({ id, name: game.players[id]?.name || 'Unknown' })),
          firstBuzzerId: game.buzzOrder[0],
          firstBuzzerName: game.players[game.buzzOrder[0]]?.name
        });
      }
    }
  });

  // Host reveals the answer text
  socket.on('reveal-answer', () => {
    const game = getHostGame(socket);
    if (!game || !game.activeQuestion) return;
    io.to(game.code).emit('answer-revealed', { answer: game.activeQuestion.answer });
  });

  // Host dismisses question without scoring
  socket.on('dismiss-question', () => {
    const game = getHostGame(socket);
    if (!game) return;
    closeQuestion(game, true);
    io.to(game.code).emit('question-closed');
  });

  // Host adjusts a player's score manually
  socket.on('adjust-score', ({ playerId, delta }) => {
    const game = getHostGame(socket);
    if (!game) return;
    const player = game.players[playerId];
    if (!player) return;
    player.score += delta;
    io.to(game.code).emit('players-update', getPlayers(game));
  });

  // Reset entire board for a new game (keep players)
  socket.on('reset-game', (boardData) => {
    const game = getHostGame(socket);
    if (!game) return;
    game.board = boardData || game.board;
    game.activeQuestion = null;
    game.buzzOrder = [];
    game.state = 'playing';
    // Reset board answered flags
    game.board.categories.forEach(cat => cat.questions.forEach(q => q.answered = false));
    // Reset scores
    Object.values(game.players).forEach(p => { p.score = 0; p.canBuzz = false; });
    io.to(game.code).emit('game-reset', { board: game.board, players: getPlayers(game) });
  });

  socket.on('disconnect', () => {
    const code = socket.data.gameCode;
    if (!code || !games[code]) return;

    const game = games[code];
    if (game.players[socket.id]) {
      const playerName = game.players[socket.id].name;
      delete game.players[socket.id];
      io.to(code).emit('player-left', {
        playerId: socket.id,
        playerName,
        players: getPlayers(game)
      });
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Jeopardy server running at http://localhost:${PORT}`);
});
