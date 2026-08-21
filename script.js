const points = [
  {id: 0, x: 50, y: 50},   {id: 1, x: 250, y: 50},  {id: 2, x: 450, y: 50},
  {id: 3, x: 50, y: 250},                            {id: 4, x: 450, y: 250},
  {id: 5, x: 50, y: 450},  {id: 6, x: 250, y: 450},  {id: 7, x: 450, y: 450},
  {id: 8, x: 150, y: 150}, {id: 9, x: 250, y: 150}, {id: 10, x: 350, y: 150},
  {id: 11, x: 150, y: 250},                          {id: 12, x: 350, y: 250},
  {id: 13, x: 150, y: 350},{id: 14, x: 250, y: 350}, {id: 15, x: 350, y: 350},
  {id: 16, x: 200, y: 200},{id: 17, x: 250, y: 200}, {id: 18, x: 300, y: 200},
  {id: 19, x: 200, y: 250},                          {id: 20, x: 300, y: 250},
  {id: 21, x: 200, y: 300},{id: 22, x: 250, y: 300}, {id: 23, x: 300, y: 300},
];

const connections = [
  [0,1],[1,2],[0,3],[2,4],[3,5],[4,7],[5,6],[6,7],
  [8,9],[9,10],[8,11],[10,12],[11,13],[12,15],[13,14],[14,15],
  [16,17],[17,18],[16,19],[18,20],[19,21],[20,23],[21,22],[22,23],
  [1,9],[9,17],[3,11],[11,19],[4,12],[12,20],[6,14],[14,22],
  [0,8],[8,16],[2,10],[10,18],[5,13],[13,21],[7,15],[15,23]
];

const millLines = [
  [0,1,2], [5,6,7], [0,3,5], [2,4,7],
  [8,9,10], [13,14,15], [8,11,13], [10,12,15],
  [16,17,18], [21,22,23], [16,19,21], [18,20,23],
  [1,9,17], [6,14,22], [3,11,19], [4,12,20],
  [0,8,16], [2,10,18], [5,13,21], [7,15,23]
];

const pointWeight = points.map((p, i) =>
  connections.filter(([a, b]) => a === i || b === i).length
);

let board = new Array(24).fill(null);
let currentPlayer = 'p1';
let piecesPlacedP1 = 0;
let piecesPlacedP2 = 0;
const maxPiecesEach = 4;
let phase = 'placement';
let selectedPiece = null;
let removingPiece = false;

const svg = document.getElementById('board');
const status = document.getElementById('status');

// ===================== Sound effects =====================

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playTone(frequency, duration, type = 'sine') {
  const oscillator = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();
  oscillator.connect(gainNode);
  gainNode.connect(audioCtx.destination);

  oscillator.type = type;
  oscillator.frequency.value = frequency;
  gainNode.gain.setValueAtTime(0.15, audioCtx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);

  oscillator.start();
  oscillator.stop(audioCtx.currentTime + duration);
}

function playPlaceSound() { playTone(440, 0.08); }
function playMillSound() { playTone(660, 0.15); setTimeout(() => playTone(880, 0.15), 100); }
function playCaptureSound() { playTone(220, 0.2, 'sawtooth'); }
function playWinSound() {
  playTone(523, 0.15);
  setTimeout(() => playTone(659, 0.15), 150);
  setTimeout(() => playTone(784, 0.3), 300);
}

// ===================== Rendering & core game logic =====================

function aiEnabled() {
  const box = document.getElementById('ai-checkbox');
  return box ? box.checked : false;
}

function getDifficulty() {
  const selected = document.querySelector('input[name="difficulty"]:checked');
  return selected ? selected.value : 'easy';
}

function drawLines() {
  connections.forEach(([a, b]) => {
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', points[a].x);
    line.setAttribute('y1', points[a].y);
    line.setAttribute('x2', points[b].x);
    line.setAttribute('y2', points[b].y);
    line.setAttribute('stroke', '#333');
    svg.appendChild(line);
  });
}

function drawPoints() {
  points.forEach(p => {
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', p.x);
    circle.setAttribute('cy', p.y);
    circle.setAttribute('r', 12);
    circle.setAttribute('id', 'point-' + p.id);
    circle.classList.add('point');
    circle.addEventListener('click', () => handleClick(p.id));
    svg.appendChild(circle);
  });
}

function updateStatus() {
  if (removingPiece) {
    status.textContent = `${currentPlayer === 'p1' ? 'Player 1' : 'Computer'} formed a mill! ${currentPlayer === 'p1' ? "Click an opponent's piece to remove it." : 'Removing a piece...'}`;
  } else if (phase === 'placement') {
    const remainingP1 = maxPiecesEach - piecesPlacedP1;
    const remainingP2 = maxPiecesEach - piecesPlacedP2;
    status.textContent = `${currentPlayer === 'p1' ? 'Player 1' : 'Computer'}'s turn — place a piece (P1 left: ${remainingP1}, P2 left: ${remainingP2})`;
  } else {
    const playerPieceCount = board.filter(p => p === currentPlayer).length;
    const flyingNote = playerPieceCount === 3 ? ' (can fly to any empty point!)' : '';
    status.textContent = `${currentPlayer === 'p1' ? 'Player 1' : 'Computer'}'s turn — move a piece${flyingNote}`;
  }
}

function updateProfiles() {
  const p1Profile = document.getElementById('player1-profile');
  const p2Profile = document.getElementById('player2-profile');

  if (currentPlayer === 'p1') {
    p1Profile.classList.add('active-turn');
    p2Profile.classList.remove('active-turn');
  } else {
    p2Profile.classList.add('active-turn');
    p1Profile.classList.remove('active-turn');
  }
}

function updateMovableHighlights() {
  points.forEach(p => {
    const el = document.getElementById('point-' + p.id);
    if (el) el.classList.remove('movable');
  });

  if (phase !== 'movement' || removingPiece) return;

  const legalMoves = getLegalMovesForPlayerEasy(currentPlayer);
  const movableFroms = new Set(legalMoves.map(m => m.from));

  movableFroms.forEach(pos => {
    const el = document.getElementById('point-' + pos);
    if (el) el.classList.add('movable');
  });
}

function addCapturedPiece(capturedPlayerId) {
  const capturedBy = capturedPlayerId === 'p1' ? 'p2-captured' : 'p1-captured';
  const box = document.getElementById(capturedBy);

  const dot = document.createElement('div');
  dot.classList.add('captured-piece');
  dot.style.background = capturedPlayerId === 'p1' ? '#1e88e5' : '#e53935';
  box.appendChild(dot);
}

function handleClick(id) {
  if (aiEnabled() && currentPlayer === 'p2') return;

  if (removingPiece) {
    handleRemoval(id);
    return;
  }
  if (phase === 'placement') {
    handlePlacement(id);
  } else {
    handleMovement(id);
  }
}

function handlePlacement(id) {
  if (board[id] !== null) return;

  board[id] = currentPlayer;
  const circle = document.getElementById('point-' + id);
  circle.classList.add(currentPlayer === 'p1' ? 'piece-p1' : 'piece-p2');
  playPlaceSound();

  if (currentPlayer === 'p1') {
    piecesPlacedP1++;
  } else {
    piecesPlacedP2++;
  }

  if (piecesPlacedP1 >= maxPiecesEach && piecesPlacedP2 >= maxPiecesEach) {
    phase = 'movement';
  }

  if (checkMill(currentPlayer, id)) {
    playMillSound();
    removingPiece = true;
    updateStatus();
    updateProfiles();
    updateMovableHighlights();
    if (currentPlayer === 'p2' && aiEnabled()) setTimeout(aiRemoval, 600);
    return;
  }

  currentPlayer = currentPlayer === 'p1' ? 'p2' : 'p1';
  updateStatus();
  updateProfiles();
  updateMovableHighlights();
  maybeAITurn();
}

function handleMovement(id) {
  if (selectedPiece === null) {
    if (board[id] === currentPlayer) {
      selectedPiece = id;
      document.getElementById('point-' + id).setAttribute('stroke', 'gold');
      document.getElementById('point-' + id).setAttribute('stroke-width', 4);
    }
  } else {
    const playerPieceCount = board.filter(p => p === currentPlayer).length;
    const canFly = playerPieceCount === 3;

    const isConnected = connections.some(([a, b]) =>
      (a === selectedPiece && b === id) || (b === selectedPiece && a === id)
    );

    const isValidMove = canFly || isConnected;

    if (isValidMove && board[id] === null) {
      board[id] = currentPlayer;
      board[selectedPiece] = null;

      document.getElementById('point-' + id).classList.add(currentPlayer === 'p1' ? 'piece-p1' : 'piece-p2');
      document.getElementById('point-' + selectedPiece).classList.remove('piece-p1', 'piece-p2');
      playPlaceSound();

      resetSelection();

      if (checkMill(currentPlayer, id)) {
        playMillSound();
        removingPiece = true;
        updateStatus();
        updateProfiles();
        updateMovableHighlights();
        return;
      }

      currentPlayer = currentPlayer === 'p1' ? 'p2' : 'p1';
      updateStatus();
      updateProfiles();
      updateMovableHighlights();
      maybeAITurn();
    } else if (board[id] === currentPlayer) {
      resetSelection();
      selectedPiece = id;
      document.getElementById('point-' + id).setAttribute('stroke', 'gold');
      document.getElementById('point-' + id).setAttribute('stroke-width', 4);
    } else {
      resetSelection();
    }
  }
}

function handleRemoval(id) {
  const opponent = currentPlayer === 'p1' ? 'p2' : 'p1';
  if (board[id] !== opponent) return;

  const opponentPieces = board
    .map((p, idx) => (p === opponent ? idx : null))
    .filter(idx => idx !== null);

  const piecesNotInMill = opponentPieces.filter(pos => !isInAnyMill(opponent, pos));
  const isTargetInMill = isInAnyMill(opponent, id);

  if (isTargetInMill && piecesNotInMill.length > 0) {
    return;
  }

  addCapturedPiece(opponent);
  playCaptureSound();
  board[id] = null;
  document.getElementById('point-' + id).classList.remove('piece-p1', 'piece-p2');
  removingPiece = false;
  currentPlayer = opponent;

  if (checkWin()) {
    return;
  }

  updateStatus();
  updateProfiles();
  updateMovableHighlights();
  maybeAITurn();
}

function checkMill(playerId, movedToId) {
  return millLines.some(line =>
    line.includes(movedToId) && line.every(pos => board[pos] === playerId)
  );
}

function isInAnyMill(playerId, pos) {
  return millLines.some(line =>
    line.includes(pos) && line.every(p => board[p] === playerId)
  );
}

function wouldCompleteMill(pos, playerId) {
  return millLines.some(line => {
    if (!line.includes(pos)) return false;
    return line.every(p => p === pos || board[p] === playerId);
  });
}

function checkWin() {
  const p1Count = board.filter(p => p === 'p1').length;
  const p2Count = board.filter(p => p === 'p2').length;

  if (phase === 'movement') {
    if (p1Count <= 2) {
      status.textContent = 'Player 1 loses — too few pieces left. Computer wins!';
      playWinSound();
      return true;
    }
    if (p2Count <= 2) {
      status.textContent = 'Player 1 wins! Computer has too few pieces left.';
      playWinSound();
      return true;
    }
  }
  return false;
}

function resetSelection() {
  if (selectedPiece !== null) {
    document.getElementById('point-' + selectedPiece).setAttribute('stroke', '#333');
    document.getElementById('point-' + selectedPiece).setAttribute('stroke-width', 2);
  }
  selectedPiece = null;
}

function restartGame() {
  board = new Array(24).fill(null);
  currentPlayer = 'p1';
  piecesPlacedP1 = 0;
  piecesPlacedP2 = 0;
  phase = 'placement';
  selectedPiece = null;
  removingPiece = false;

  document.getElementById('p1-captured').innerHTML = '';
  document.getElementById('p2-captured').innerHTML = '';

  svg.innerHTML = svg.querySelector('defs') ? svg.querySelector('defs').outerHTML : '';
  drawLines();
  drawPoints();
  updateStatus();
  updateProfiles();
  updateMovableHighlights();
}

// ===================== EASY AI helpers (also used for move highlighting) =====================

function getLegalMovesForPlayerEasy(playerId) {
  const piecePositions = board.map((v, i) => (v === playerId ? i : null)).filter(i => i !== null);
  const canFly = piecePositions.length === 3;
  const moves = [];

  piecePositions.forEach(from => {
    if (canFly) {
      board.forEach((v, to) => { if (v === null) moves.push({ from, to }); });
    } else {
      connections.forEach(([a, b]) => {
        if (a === from && board[b] === null) moves.push({ from, to: b });
        if (b === from && board[a] === null) moves.push({ from, to: a });
      });
    }
  });

  return moves;
}

// ===================== Lookahead engine (used by Hard AI and Hint) =====================

function cloneBoard(b) {
  return b.slice();
}

function checkMillOnBoard(boardState, playerId, movedToId) {
  return millLines.some(line =>
    line.includes(movedToId) && line.every(pos => boardState[pos] === playerId)
  );
}

function isInAnyMillOnBoard(boardState, playerId, pos) {
  return millLines.some(line =>
    line.includes(pos) && line.every(p => boardState[p] === playerId)
  );
}

function getLegalMovesOnBoard(boardState, playerId, isPlacement) {
  if (isPlacement) {
    return boardState
      .map((v, i) => (v === null ? { to: i, isPlacement: true } : null))
      .filter(m => m !== null);
  }

  const piecePositions = boardState.map((v, i) => (v === playerId ? i : null)).filter(i => i !== null);
  const canFly = piecePositions.length === 3;
  const moves = [];

  piecePositions.forEach(from => {
    if (canFly) {
      boardState.forEach((v, to) => {
        if (v === null) moves.push({ from, to });
      });
    } else {
      connections.forEach(([a, b]) => {
        if (a === from && boardState[b] === null) moves.push({ from, to: b });
        if (b === from && boardState[a] === null) moves.push({ from, to: a });
      });
    }
  });

  return moves;
}

function applyMoveToBoard(boardState, move, playerId) {
  const nb = cloneBoard(boardState);
  if (move.isPlacement) {
    nb[move.to] = playerId;
  } else {
    nb[move.to] = playerId;
    nb[move.from] = null;
  }
  return nb;
}

function simulateBestCapture(boardState, capturingPlayer) {
  const opponent = capturingPlayer === 'p1' ? 'p2' : 'p1';
  const opponentPieces = boardState.map((v, i) => (v === opponent ? i : null)).filter(i => i !== null);
  const notInMill = opponentPieces.filter(pos => !isInAnyMillOnBoard(boardState, opponent, pos));
  const candidates = notInMill.length > 0 ? notInMill : opponentPieces;

  if (candidates.length === 0) return boardState;

  let best = candidates[0];
  candidates.forEach(c => {
    if (pointWeight[c] > pointWeight[best]) best = c;
  });

  const nb = cloneBoard(boardState);
  nb[best] = null;
  return nb;
}

function evaluateBoard(boardState, forPlayer) {
  const opponent = forPlayer === 'p1' ? 'p2' : 'p1';
  let score = 0;

  const myCount = boardState.filter(v => v === forPlayer).length;
  const oppCount = boardState.filter(v => v === opponent).length;
  score += (myCount - oppCount) * 10;

  boardState.forEach((v, i) => {
    if (v === forPlayer) score += pointWeight[i];
    else if (v === opponent) score -= pointWeight[i];
  });

  millLines.forEach(line => {
    const vals = line.map(p => boardState[p]);
    const forC = vals.filter(v => v === forPlayer).length;
    const oppC = vals.filter(v => v === opponent).length;
    const emptyC = vals.filter(v => v === null).length;

    if (forC === 2 && emptyC === 1) score += 3;
    if (oppC === 2 && emptyC === 1) score -= 3;
  });

  return score;
}

function aiChooseMove() {
  return aiChooseMoveFor('p2');
}

function aiChooseMoveFor(forId) {
  const opponentId = forId === 'p1' ? 'p2' : 'p1';
  const isPlacement = phase === 'placement';
  const myMoves = getLegalMovesOnBoard(board, forId, isPlacement);
  if (myMoves.length === 0) return null;

  let bestScore = -Infinity;
  let bestMove = myMoves[0];

  myMoves.forEach(move => {
    let simBoard = applyMoveToBoard(board, move, forId);

    if (checkMillOnBoard(simBoard, forId, move.to)) {
      simBoard = simulateBestCapture(simBoard, forId);
    }

    const oppMoves = getLegalMovesOnBoard(simBoard, opponentId, isPlacement);

    let worstForUs;
    if (oppMoves.length === 0) {
      worstForUs = evaluateBoard(simBoard, forId);
    } else {
      worstForUs = Infinity;
      oppMoves.forEach(oMove => {
        let oppBoard = applyMoveToBoard(simBoard, oMove, opponentId);
        if (checkMillOnBoard(oppBoard, opponentId, oMove.to)) {
          oppBoard = simulateBestCapture(oppBoard, opponentId);
        }
        const score = evaluateBoard(oppBoard, forId);
        if (score < worstForUs) worstForUs = score;
      });
    }

    if (worstForUs > bestScore) {
      bestScore = worstForUs;
      bestMove = move;
    }
  });

  return bestMove;
}

// ===================== Hint feature =====================

function showHint() {
  if (currentPlayer !== 'p1' || removingPiece) return;

  const move = aiChooseMoveFor('p1');
  if (!move) return;

  const fromEl = move.from !== undefined ? document.getElementById('point-' + move.from) : null;
  const toEl = document.getElementById('point-' + move.to);

  if (fromEl) {
    fromEl.setAttribute('stroke', '#9b59b6');
    fromEl.classList.add('hint-highlight');
  }
  toEl.setAttribute('stroke', '#9b59b6');
  toEl.classList.add('hint-highlight');

  setTimeout(() => {
    if (fromEl) {
      fromEl.classList.remove('hint-highlight');
      if (board[move.from] !== null) {
        fromEl.setAttribute('stroke', '#333');
      }
    }
    toEl.classList.remove('hint-highlight');
    if (board[move.to] === null) {
      toEl.setAttribute('stroke', '#333');
    }
    updateMovableHighlights();
  }, 2000);
}

// ===================== AI turn dispatch =====================

function maybeAITurn() {
  if (!aiEnabled() || currentPlayer !== 'p2' || removingPiece) return;
  setTimeout(aiTakeTurn, 500);
}

function aiTakeTurn() {
  if (phase === 'placement') {
    aiPlacement();
  } else {
    aiMovement();
  }
}

function aiPlacement() {
  let choice;

  if (getDifficulty() === 'hard') {
    const move = aiChooseMove();
    if (!move) return;
    choice = move.to;
  } else {
    const empties = board.map((v, i) => (v === null ? i : null)).filter(i => i !== null);
    if (empties.length === 0) return;
    choice = empties.find(pos => wouldCompleteMill(pos, 'p2'));
    if (choice === undefined) choice = empties.find(pos => wouldCompleteMill(pos, 'p1'));
    if (choice === undefined) choice = empties[Math.floor(Math.random() * empties.length)];
  }

  board[choice] = 'p2';
  document.getElementById('point-' + choice).classList.add('piece-p2');
  playPlaceSound();
  piecesPlacedP2++;

  if (piecesPlacedP1 >= maxPiecesEach && piecesPlacedP2 >= maxPiecesEach) {
    phase = 'movement';
  }

  if (checkMill('p2', choice)) {
    playMillSound();
    removingPiece = true;
    updateStatus();
    updateProfiles();
    updateMovableHighlights();
    setTimeout(aiRemoval, 600);
    return;
  }

  currentPlayer = 'p1';
  updateStatus();
  updateProfiles();
  updateMovableHighlights();
}

function aiMovement() {
  let move;

  if (getDifficulty() === 'hard') {
    move = aiChooseMove();
  } else {
    const moves = getLegalMovesForPlayerEasy('p2');
    if (moves.length === 0) return;
    move = moves.find(m => wouldCompleteMill(m.to, 'p2'));
    if (!move) move = moves.find(m => wouldCompleteMill(m.to, 'p1'));
    if (!move) move = moves[Math.floor(Math.random() * moves.length)];
  }

  if (!move) return;

  board[move.to] = 'p2';
  board[move.from] = null;
  document.getElementById('point-' + move.to).classList.add('piece-p2');
  document.getElementById('point-' + move.from).classList.remove('piece-p2');
  playPlaceSound();

  if (checkMill('p2', move.to)) {
    playMillSound();
    removingPiece = true;
    updateStatus();
    updateProfiles();
    updateMovableHighlights();
    setTimeout(aiRemoval, 600);
    return;
  }

  currentPlayer = 'p1';
  updateStatus();
  updateProfiles();
  updateMovableHighlights();
}

function aiRemoval() {
  const opponent = 'p1';
  const opponentPieces = board.map((p, i) => (p === opponent ? i : null)).filter(i => i !== null);
  const notInMill = opponentPieces.filter(pos => !isInAnyMill(opponent, pos));
  const candidates = notInMill.length > 0 ? notInMill : opponentPieces;

  if (candidates.length === 0) return;

  let target;
  if (getDifficulty() === 'hard') {
    target = candidates[0];
    candidates.forEach(c => { if (pointWeight[c] > pointWeight[target]) target = c; });
  } else {
    target = candidates[Math.floor(Math.random() * candidates.length)];
  }

  addCapturedPiece(opponent);
  playCaptureSound();
  board[target] = null;
  document.getElementById('point-' + target).classList.remove('piece-p1', 'piece-p2');
  removingPiece = false;
  currentPlayer = opponent;

  if (checkWin()) return;

  updateStatus();
  updateProfiles();
  updateMovableHighlights();
}

drawLines();
drawPoints();
updateStatus();
updateProfiles();
updateMovableHighlights();
