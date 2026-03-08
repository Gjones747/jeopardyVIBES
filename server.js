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
    finalJeopardy: game.finalJeopardy ? { category: game.finalJeopardy.category, revealed: game.finalJeopardy.revealed } : null,
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
      finalJeopardy: null,
      state: 'lobby'
    };

    socket.join(code);
    socket.data.gameCode = code;
    socket.data.isHost = true;
    callback({ success: true, code });
  });

  socket.on('join-board', (code, callback) => {
    const game = games[code];
    if (!game) return callback({ error: 'Game not found' });
    socket.join(code);
    socket.data.gameCode = code;
    socket.data.isBoard = true;
    callback({ success: true, game: serializeGame(game) });
  });

  socket.on('join-game', ({ code, name }, callback) => {
    const game = games[code];
    if (!game) return callback({ error: 'Game not found' });
    if (!name?.trim()) return callback({ error: 'Name required' });

    let playerName = name.trim().substring(0, 20);
    const existingNames = Object.values(game.players).map(p => p.name.toLowerCase());
    if (existingNames.includes(playerName.toLowerCase())) {
      playerName = playerName + Math.floor(Math.random() * 100);
    }

    game.players[socket.id] = { id: socket.id, name: playerName, score: 0, canBuzz: false, fjWager: null };
    socket.join(code);
    socket.data.gameCode = code;
    socket.data.playerName = playerName;

    io.to(code).emit('players-update', getPlayers(game));
    callback({ success: true, name: playerName, game: serializeGame(game) });
  });

  socket.on('start-game', () => {
    const game = getHostGame(socket);
    if (!game) return;
    game.state = 'playing';
    io.to(game.code).emit('game-started', { board: game.board });
  });

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
      answerTimeLimit: Math.max(5, Math.min(60, parseInt(answerTimeLimit) || 10)),
      ddPlayerId: null,
      ddWager: null,
    };
    game.buzzOrder = [];
    game.state = 'question-active';

    // For Daily Double, only the host reveals — no buzzing
    if (!q.dailyDouble) {
      Object.values(game.players).forEach(p => p.canBuzz = true);
    }

    io.to(game.code).emit('question-active', game.activeQuestion);
  });

  // Host sets the DD wager and reveals the clue
  socket.on('dd-reveal', ({ playerId, wager }) => {
    const game = getHostGame(socket);
    if (!game || !game.activeQuestion?.dailyDouble) return;

    const player = game.players[playerId];
    if (!player) return;

    const maxWager = Math.max(1000, player.score > 0 ? player.score : 0);
    const validWager = Math.max(5, Math.min(parseInt(wager) || 5, maxWager));

    game.activeQuestion.ddPlayerId = playerId;
    game.activeQuestion.ddWager = validWager;

    io.to(game.code).emit('dd-revealed', {
      playerId,
      playerName: player.name,
      wager: validWager,
      clue: game.activeQuestion.clue,
      answer: game.activeQuestion.answer,
    });
  });

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

  socket.on('answer-result', ({ correct }) => {
    const game = getHostGame(socket);
    if (!game || !game.activeQuestion) return;

    // Daily Double scoring
    if (game.activeQuestion.dailyDouble) {
      const playerId = game.activeQuestion.ddPlayerId;
      const wager = game.activeQuestion.ddWager;
      if (!playerId || wager == null) return;

      const player = game.players[playerId];
      if (!player) return;

      if (correct) player.score += wager;
      else player.score -= wager;

      const snapshot = { playerId, playerName: player.name, value: wager, players: getPlayers(game) };
      closeQuestion(game, true);
      io.to(game.code).emit(correct ? 'answer-correct' : 'answer-wrong', snapshot);
      io.to(game.code).emit('question-closed');
      return;
    }

    // Normal buzz scoring
    if (game.buzzOrder.length === 0) return;
    const firstId = game.buzzOrder[0];
    const player = game.players[firstId];
    if (!player) return;

    const value = game.activeQuestion.value;

    if (correct) {
      player.score += value;
      const snapshot = { playerId: firstId, playerName: player.name, value, players: getPlayers(game) };
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

      if (game.buzzOrder.length > 0) {
        io.to(game.code).emit('buzz-update', {
          buzzOrder: game.buzzOrder.map(id => ({ id, name: game.players[id]?.name || 'Unknown' })),
          firstBuzzerId: game.buzzOrder[0],
          firstBuzzerName: game.players[game.buzzOrder[0]]?.name
        });
      }
    }
  });

  socket.on('reveal-answer', () => {
    const game = getHostGame(socket);
    if (!game || !game.activeQuestion) return;
    io.to(game.code).emit('answer-revealed', { answer: game.activeQuestion.answer });
  });

  socket.on('dismiss-question', () => {
    const game = getHostGame(socket);
    if (!game) return;
    closeQuestion(game, true);
    io.to(game.code).emit('question-closed');
  });

  socket.on('adjust-score', ({ playerId, delta }) => {
    const game = getHostGame(socket);
    if (!game) return;
    const player = game.players[playerId];
    if (!player) return;
    player.score += delta;
    io.to(game.code).emit('players-update', getPlayers(game));
  });

  // ==================== FINAL JEOPARDY ====================

  socket.on('start-final-jeopardy', ({ category, clue, answer }) => {
    const game = getHostGame(socket);
    if (!game) return;

    game.state = 'final-jeopardy';
    game.finalJeopardy = { category, clue, answer, wagers: {}, revealed: false };
    game.activeQuestion = null;
    game.buzzOrder = [];
    Object.values(game.players).forEach(p => { p.canBuzz = false; p.fjWager = null; });

    io.to(game.code).emit('final-jeopardy-started', {
      category,
      players: getPlayers(game)
    });
  });

  socket.on('submit-wager', ({ amount }) => {
    const code = socket.data.gameCode;
    const game = games[code];
    if (!game || game.state !== 'final-jeopardy') return;

    const player = game.players[socket.id];
    if (!player) return;

    const maxWager = Math.max(0, player.score);
    const wager = Math.max(0, Math.min(parseInt(amount) || 0, maxWager));
    player.fjWager = wager;
    game.finalJeopardy.wagers[socket.id] = wager;

    io.to(game.code).emit('fj-wager-received', {
      playerId: socket.id,
      playerName: player.name,
      wageredCount: Object.keys(game.finalJeopardy.wagers).length,
      totalPlayers: Object.keys(game.players).length
    });

    // Confirm back to the player
    socket.emit('fj-wager-confirmed', { wager });
  });

  socket.on('reveal-final-clue', () => {
    const game = getHostGame(socket);
    if (!game || !game.finalJeopardy) return;
    game.finalJeopardy.revealed = true;
    io.to(game.code).emit('fj-clue-revealed', { clue: game.finalJeopardy.clue });
  });

  socket.on('final-answer-result', ({ playerId, correct }) => {
    const game = getHostGame(socket);
    if (!game || !game.finalJeopardy) return;

    const player = game.players[playerId];
    if (!player) return;

    const wager = player.fjWager ?? 0;
    if (correct) player.score += wager;
    else player.score -= wager;

    io.to(game.code).emit('fj-answer-result', {
      playerId,
      playerName: player.name,
      correct,
      wager,
      newScore: player.score,
      players: getPlayers(game)
    });
  });

  socket.on('end-game', () => {
    const game = getHostGame(socket);
    if (!game) return;
    game.state = 'ended';
    io.to(game.code).emit('game-ended', { players: getPlayers(game) });
  });

  // ==================== RESET / DISCONNECT ====================

  socket.on('reset-game', (boardData) => {
    const game = getHostGame(socket);
    if (!game) return;
    game.board = boardData || game.board;
    game.activeQuestion = null;
    game.buzzOrder = [];
    game.finalJeopardy = null;
    game.state = 'playing';
    game.board.categories.forEach(cat => cat.questions.forEach(q => q.answered = false));
    Object.values(game.players).forEach(p => { p.score = 0; p.canBuzz = false; p.fjWager = null; });
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

const PORT = process.env.PORT || 2999;
server.listen(PORT, () => {
  console.log(`Jeopardy server running at http://localhost:${PORT}`);
});
