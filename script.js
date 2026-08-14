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

let board = new Array(24).fill(null);
let currentPlayer = 'p1';
let piecesPlacedP1 = 0;
let piecesPlacedP2 = 0;
const maxPiecesEach = 12;
let phase = 'placement';
let selectedPiece = null;
let removingPiece = false;

const svg = document.getElementById('board');
const status = document.getElementById('status');

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
    status.textContent = `${currentPlayer === 'p1' ? 'Player 1' : 'Player 2'} formed a mill! Click an opponent's piece to remove it.`;
  } else if (phase === 'placement') {
    const remainingP1 = maxPiecesEach - piecesPlacedP1;
    const remainingP2 = maxPiecesEach - piecesPlacedP2;
    status.textContent = `${currentPlayer === 'p1' ? 'Player 1' : 'Player 2'}'s turn — place a piece (P1 left: ${remainingP1}, P2 left: ${remainingP2})`;
  } else {
    status.textContent = `${currentPlayer === 'p1' ? 'Player 1' : 'Player 2'}'s turn — move a piece`;
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

function addCapturedPiece(capturedPlayerId) {
  const capturedBy = capturedPlayerId === 'p1' ? 'p2-captured' : 'p1-captured';
  const box = document.getElementById(capturedBy);

  const dot = document.createElement('div');
  dot.classList.add('captured-piece');
  dot.style.background = capturedPlayerId === 'p1' ? '#1e88e5' : '#e53935';
  box.appendChild(dot);
}

function handleClick(id) {
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

  if (currentPlayer === 'p1') {
    piecesPlacedP1++;
  } else {
    piecesPlacedP2++;
  }

  if (piecesPlacedP1 >= maxPiecesEach && piecesPlacedP2 >= maxPiecesEach) {
    phase = 'movement';
  }

  if (checkMill(currentPlayer, id)) {
    removingPiece = true;
    updateStatus();
    updateProfiles();
    return;
  }

  currentPlayer = currentPlayer === 'p1' ? 'p2' : 'p1';
  updateStatus();
  updateProfiles();
}

function handleMovement(id) {
  if (selectedPiece === null) {
    if (board[id] === currentPlayer) {
      selectedPiece = id;
      document.getElementById('point-' + id).setAttribute('stroke', 'gold');
      document.getElementById('point-' + id).setAttribute('stroke-width', 4);
    }
  } else {
    const isConnected = connections.some(([a, b]) =>
      (a === selectedPiece && b === id) || (b === selectedPiece && a === id)
    );

    if (isConnected && board[id] === null) {
      board[id] = currentPlayer;
      board[selectedPiece] = null;

      document.getElementById('point-' + id).classList.add(currentPlayer === 'p1' ? 'piece-p1' : 'piece-p2');
      document.getElementById('point-' + selectedPiece).classList.remove('piece-p1', 'piece-p2');

      resetSelection();

      if (checkMill(currentPlayer, id)) {
        removingPiece = true;
        updateStatus();
        updateProfiles();
        return;
      }

      currentPlayer = currentPlayer === 'p1' ? 'p2' : 'p1';
      updateStatus();
      updateProfiles();
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
  if (board[id] === opponent) {
    addCapturedPiece(opponent);
    board[id] = null;
    document.getElementById('point-' + id).classList.remove('piece-p1', 'piece-p2');
    removingPiece = false;
    currentPlayer = opponent;

    if (checkWin()) {
      return;
    }

    updateStatus();
    updateProfiles();
  }
}

function checkMill(playerId, movedToId) {
  return millLines.some(line =>
    line.includes(movedToId) && line.every(pos => board[pos] === playerId)
  );
}

function checkWin() {
  const p1Count = board.filter(p => p === 'p1').length;
  const p2Count = board.filter(p => p === 'p2').length;

  if (phase === 'movement') {
    if (p1Count <= 2) {
      status.textContent = 'Player 2 wins! Player 1 has too few pieces left.';
      return true;
    }
    if (p2Count <= 2) {
      status.textContent = 'Player 1 wins! Player 2 has too few pieces left.';
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

  svg.innerHTML = '';
  drawLines();
  drawPoints();
  updateStatus();
  updateProfiles();
}

drawLines();
drawPoints();
updateStatus();
updateProfiles();
