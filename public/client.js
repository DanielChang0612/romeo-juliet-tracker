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

// Action Card elements
const currentFloorLabel = document.getElementById('current-floor-label');
const prevFloorBtn = document.getElementById('prev-floor-btn');
const nextFloorBtn = document.getElementById('next-floor-btn');
const actionBtns = document.querySelectorAll('.my-plat-btn');

// Cheatsheet Elements
const cheatsheetBody = document.getElementById('cheatsheet-body');

// State
let myRoomId = '';
let myPlayerId = -1; 
let playerNames = ['玩家 A', '玩家 B', '玩家 C', '玩家 D'];
let globalMatrix = []; // stores matrix passed from server
let currentFocusFloor = 0; // 0 to 9

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
    
    // Optimistic update of own identity name
    if (customName) playerNames[myPlayerId] = customName;
    displayIdentity.innerText = `我是角色: ${playerNames[myPlayerId]}`;
    displayIdentity.style.color = `var(--color-p${myPlayerId})`;

    loginScreen.classList.remove('active');
    setTimeout(() => {
        loginScreen.classList.add('hidden');
        appScreen.classList.remove('hidden');
        appScreen.classList.add('active');
        
        initCheatsheetUI();

        socket.emit('joinRoom', { 
            roomId: myRoomId, 
            playerId: myPlayerId, 
            playerName: customName 
        });
    }, 400);
});

resetBtn.addEventListener('click', () => {
    if (confirm('確定要重置整個房間的紀錄嗎？')) {
        socket.emit('resetRoom', myRoomId);
        currentFocusFloor = 0;
    }
});

// Navigation Logic
prevFloorBtn.addEventListener('click', () => {
    if (currentFocusFloor > 0) {
        currentFocusFloor--;
        updateFocusFloorUI();
    }
});

nextFloorBtn.addEventListener('click', () => {
    if (currentFocusFloor < 9) {
        currentFocusFloor++;
        updateFocusFloorUI();
    }
});

// Action Card Buttons Event Listener
actionBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
        if (!globalMatrix || globalMatrix.length === 0) return;
        
        const platform = parseInt(e.target.getAttribute('data-plat'));

        let existingCorrectPlatform = -1;
        if (globalMatrix && globalMatrix[currentFocusFloor]) {
            for (let i = 0; i < 4; i++) {
                if (globalMatrix[currentFocusFloor][myPlayerId][i] === 1) {
                    existingCorrectPlatform = i;
                }
            }
        }

        let newValue = 1; // Default to Complete (✅)
        if (e.target.classList.contains('state-correct')) {
            newValue = -1; // Toggle to Wrong (❌)
        } else if (e.target.classList.contains('state-wrong')) {
            if (existingCorrectPlatform !== -1) {
                // Radio override: they have a ✅ elsewhere, and clicked this deduced ❌. They want to move the ✅ here.
                newValue = 1;
            } else {
                // Normal undo of a manual ❌
                newValue = 0; 
            }
        }

        // UX: Radio behavior if setting to correct and there is already one elsewhere
        if (newValue === 1 && existingCorrectPlatform !== -1 && existingCorrectPlatform !== platform) {
            socket.emit('updateState', {
                roomId: myRoomId,
                floor: currentFocusFloor,
                player: myPlayerId,
                platform: existingCorrectPlatform,
                value: 0
            });
        }

        // Before sending update, predict auto-scroll
        const wasPreviouslyCorrect = e.target.classList.contains('state-correct');
        const willBeCorrect = newValue === 1;

        socket.emit('updateState', {
            roomId: myRoomId,
            floor: currentFocusFloor,
            player: myPlayerId,
            platform,
            value: newValue
        });

        // Advanced UX auto-scroll if setting to correct and we are not on top floor
        if (!wasPreviouslyCorrect && willBeCorrect && currentFocusFloor < 9) {
            setTimeout(() => {
                currentFocusFloor++;
                updateFocusFloorUI();
            }, 500); // 0.5s delay to let users see the effect
        }
    });

    // Setup border colors based on player choice during init
    btn.classList.add(`border-p${myPlayerId}`);
});

// Construct empty cheat sheet
function initCheatsheetUI() {
    cheatsheetBody.innerHTML = '';
    for (let f = 0; f < 10; f++) {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td style="color:var(--text-muted); font-size:0.9rem;">第 ${f + 1} 層</td>
            <td id="cs-${f}-0" class="cs-cell">-</td>
            <td id="cs-${f}-1" class="cs-cell">-</td>
            <td id="cs-${f}-2" class="cs-cell">-</td>
            <td id="cs-${f}-3" class="cs-cell">-</td>`;
        cheatsheetBody.appendChild(tr);
    }
}

// Ensure the th/td representing the current user is subtly highlighted in the table
function updateTableHighlights() {
    for (let p = 0; p < 4; p++) {
        const th = document.querySelector(`.th-p${p}`);
        if(th) {
            th.classList.toggle('my-col-th', p === myPlayerId);
        }
        for (let f = 0; f < 10; f++) {
            const td = document.getElementById(`cs-${f}-${p}`);
            if (td) {
                td.classList.toggle('my-col', p === myPlayerId);
            }
        }
    }
}

function updateLabels() {
    for (let p = 0; p < 4; p++) {
        const th = document.querySelector(`.th-p${p}`);
        if (th) th.innerText = playerNames[p];
    }
    updateTableHighlights();
}

function updateFocusFloorUI() {
    currentFloorLabel.innerText = `第 ${currentFocusFloor + 1} 層`;
    
    // Disable buttons on edges
    prevFloorBtn.disabled = currentFocusFloor === 0;
    nextFloorBtn.disabled = currentFocusFloor === 9;

    if (!globalMatrix || globalMatrix.length === 0) return;

    for (let pl = 0; pl < 4; pl++) {
        const btn = document.querySelector(`.my-plat-btn[data-plat="${pl}"]`);
        if (!btn) continue;
        
        const val = globalMatrix[currentFocusFloor][myPlayerId][pl];
        
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

function updateCheatsheetRow(f) {
    if (!globalMatrix) return;
    const floorMatrix = globalMatrix[f];
    
    for (let p = 0; p < 4; p++) {
        const cell = document.getElementById(`cs-${f}-${p}`);
        if (!cell) continue;

        let foundCorrect = -1;
        for (let pl = 0; pl < 4; pl++) {
            if (floorMatrix[p][pl] === 1) foundCorrect = pl;
        }

        if (foundCorrect !== -1) {
            cell.innerText = foundCorrect + 1;
            cell.className = `cs-cell td-correct ${p === myPlayerId ? 'my-col' : ''}`;
        } else {
            // Find if there are any failures to mark? Not needed, cheat sheet just shows correct path.
            cell.innerText = '-';
            cell.className = `cs-cell td-unknown ${p === myPlayerId ? 'my-col' : ''}`;
        }
    }
}

// Socket listening
socket.on('initialState', (data) => {
    const { matrix, names } = data;
    playerNames = names;
    globalMatrix = matrix;

    updateLabels();
    updateFocusFloorUI();
    
    for (let f = 0; f < 10; f++) {
        updateCheatsheetRow(f);
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

socket.on('stateUpdated', (data) => {
    const { floor, matrix } = data;
    globalMatrix[floor] = matrix;
    
    if (floor === currentFocusFloor) updateFocusFloorUI();
    updateCheatsheetRow(floor);
});

socket.on('joinError', (msg) => {
    alert(msg);
    window.location.reload();
});
