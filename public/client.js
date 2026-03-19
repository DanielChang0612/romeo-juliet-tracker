const socket = io();

// DOM Elements
const loginScreen = document.getElementById('login-screen');
const appScreen = document.getElementById('app-screen');
const roomInput = document.getElementById('room-input');
const playerBtns = document.querySelectorAll('.player-btn');
const joinBtn = document.getElementById('join-btn');
const displayRoom = document.getElementById('display-room');
const displayIdentity = document.getElementById('display-identity');
const resetBtn = document.getElementById('reset-btn');
const floorsContainer = document.getElementById('floors-container');

// State
let myRoomId = '';
let myPlayerId = -1; 
let playerNames = ['玩家 A', '玩家 B', '玩家 C', '玩家 D'];

// Login logic
playerBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
        playerBtns.forEach(b => b.classList.remove('selected'));
        e.target.classList.add('selected');
        myPlayerId = parseInt(e.target.getAttribute('data-id'));
    });
});

document.getElementById('random-room-btn').addEventListener('click', () => {
    roomInput.value = Math.random().toString(36).substring(2, 6).toUpperCase();
});

joinBtn.addEventListener('click', () => {
    const roomId = roomInput.value.trim().toUpperCase();
    if (!roomId) {
        alert('請輸入房間代號！');
        return;
    }
    if (myPlayerId === -1) {
        alert('請選擇你的身份角色！');
        return;
    }

    const customName = document.getElementById('my-name-input').value.trim();

    myRoomId = roomId;
    displayRoom.innerText = myRoomId;
    
    // Optimistic update of own identity name, actual sync will update the rest
    if (customName) playerNames[myPlayerId] = customName;
    displayIdentity.innerText = `我是角色: ${playerNames[myPlayerId]}`;
    displayIdentity.style.color = `var(--color-p${myPlayerId})`;

    loginScreen.classList.remove('active');
    setTimeout(() => {
        loginScreen.classList.add('hidden');
        appScreen.classList.remove('hidden');
        appScreen.classList.add('active');
        socket.emit('joinRoom', { 
            roomId: myRoomId, 
            playerId: myPlayerId, 
            playerName: customName 
        });
    }, 400); // Wait for fade out
});

resetBtn.addEventListener('click', () => {
    if (confirm('確定要重置所有樓層的紀錄嗎？')) {
        socket.emit('resetRoom', myRoomId);
    }
});

// Initialize UI Matrix
function createMatrixUI() {
    floorsContainer.innerHTML = '';
    // Floors 9 down to 0 (visually 10 to 1)
    for (let f = 9; f >= 0; f--) {
        const floorCard = document.createElement('div');
        floorCard.className = 'floor-card';
        floorCard.innerHTML = `
            <div class="floor-header">
                <div>第 ${f + 1} 層 <span>Floor ${f + 1}</span></div>
            </div>
        `;
        
        for (let p = 0; p < 4; p++) {
            const row = document.createElement('div');
            row.className = `matrix-row ${myPlayerId === p ? 'my-row' : ''}`;
            
            const label = document.createElement('div');
            label.className = `player-label l-p${p}`;
            label.innerText = playerNames[p];
            row.appendChild(label);

            for (let pl = 0; pl < 4; pl++) {
                const btn = document.createElement('button');
                btn.className = 'plat-btn';
                btn.id = `btn-${f}-${p}-${pl}`;
                btn.innerText = pl + 1; // 1, 2, 3, 4
                
                // Interaction
                btn.addEventListener('click', () => {
                    handlePlatformClick(f, p, pl);
                });

                row.appendChild(btn);
            }
            floorCard.appendChild(row);
        }
        floorsContainer.appendChild(floorCard);
    }
}

function handlePlatformClick(floor, player, platform) {
    if (player !== myPlayerId) {
        // Can't click other players' rows
        return;
    }

    // Current state check from DOM classes
    const btn = document.getElementById(`btn-${floor}-${player}-${platform}`);
    if (btn.classList.contains('state-correct')) return; // Already solved

    let newValue = -1; // Default to marking wrong on click
    if (btn.classList.contains('state-wrong')) {
        newValue = 0; // Toggle back to unknown (undo)
    }

    socket.emit('updateState', {
        roomId: myRoomId,
        floor,
        player,
        platform,
        value: newValue
    });
}

// Socket listening
socket.on('initialState', (data) => {
    const { matrix, names } = data;
    playerNames = names;

    // Recreate UI or update names
    if (floorsContainer.children.length === 0) {
        createMatrixUI();
    } else {
        updateLabels();
    }
    
    // Apply full matrix
    for (let f = 0; f < 10; f++) {
        updateFloorUI(f, matrix[f]);
    }

    if (myPlayerId !== -1) {
        displayIdentity.innerText = `我是角色: ${playerNames[myPlayerId]}`;
    }
});

socket.on('namesUpdated', (names) => {
    playerNames = names;
    updateLabels();
    if (myPlayerId !== -1) {
        displayIdentity.innerText = `我是角色: ${playerNames[myPlayerId]}`;
    }
});

socket.on('joinError', (msg) => {
    alert(msg);
    window.location.reload(); // Reload to reset state safely
});

function updateLabels() {
    for (let p = 0; p < 4; p++) {
        const labels = document.querySelectorAll(`.l-p${p}`);
        labels.forEach(l => l.innerText = playerNames[p]);
    }
}

socket.on('stateUpdated', (data) => {
    const { floor, matrix } = data;
    updateFloorUI(floor, matrix);
});

function updateFloorUI(floor, floorMatrix) {
    for (let p = 0; p < 4; p++) {
        for (let pl = 0; pl < 4; pl++) {
            const val = floorMatrix[p][pl];
            const btn = document.getElementById(`btn-${floor}-${p}-${pl}`);
            if (!btn) continue;

            // Reset classes
            btn.classList.remove('state-wrong', 'state-correct');
            btn.innerHTML = pl + 1;

            if (val === -1) {
                btn.classList.add('state-wrong');
                btn.innerHTML = '❌';
            } else if (val === 1) {
                btn.classList.add('state-correct');
                btn.innerHTML = '✅';
            }
        }
    }
}
