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
const pathDisplay = document.getElementById('my-path-display');

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
    for (let f = 9; f >= 0; f--) {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td style="color:var(--text-muted); font-size:1rem; font-weight:800;">${f + 1}</td>
            <td id="cs-${f}-0" class="cs-cell">-</td>
            <td id="cs-${f}-1" class="cs-cell">-</td>
            <td id="cs-${f}-2" class="cs-cell">-</td>
            <td id="cs-${f}-3" class="cs-cell">-</td>`;
        cheatsheetBody.appendChild(tr);
    }
}

// Ensure the th/td representing the current user is subtly highlighted in the table
function updateLabels() {
    // Re-render cheatsheet entirely on name change
    for (let f = 0; f < 10; f++) {
        updateCheatsheetRow(f);
    }
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
    
    // pl represents platform (0-3) which aligns with table columns
    for (let pl = 0; pl < 4; pl++) {
        const cell = document.getElementById(`cs-${f}-${pl}`);
        if (!cell) continue;

        let foundPlayer = -1;
        for (let p = 0; p < 4; p++) {
            if (floorMatrix[p][pl] === 1) foundPlayer = p;
        }

        if (foundPlayer !== -1) {
            cell.innerHTML = `<span class="cs-badge p${foundPlayer}">${playerNames[foundPlayer]}</span>`;
            cell.className = 'cs-cell'; // Strip other state classes
        } else {
            cell.innerText = '-';
            cell.className = 'cs-cell td-unknown';
        }
    }
}

function updateMyPathDisplay() {
    if (!globalMatrix || globalMatrix.length === 0 || myPlayerId === -1) return;
    
    let htmlStr = "";
    for (let f = 0; f < 10; f++) {
        const floorMatrix = globalMatrix[f];
        let found = "?";
        for (let pl = 0; pl < 4; pl++) {
            if (floorMatrix[myPlayerId][pl] === 1) {
                found = (pl + 1).toString();
            }
        }
        htmlStr += found;
        if (f === 4) htmlStr += "&nbsp;&nbsp;&nbsp;";
        else if (f < 9) htmlStr += "&nbsp;";
    }
    
    if (pathDisplay) {
        pathDisplay.innerHTML = htmlStr;
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
        updateMyPathDisplay();
    }
});

socket.on('namesUpdated', (names) => {
    playerNames = names;
    updateLabels();
    if (myPlayerId !== -1) {
        displayIdentity.innerText = `我是角色: ${playerNames[myPlayerId]}`;
        updateMyPathDisplay();
    }
});

socket.on('stateUpdated', (data) => {
    const { floor, matrix } = data;
    globalMatrix[floor] = matrix;
    
    if (floor === currentFocusFloor) updateFocusFloorUI();
    updateCheatsheetRow(floor);
    updateMyPathDisplay();
});

socket.on('joinError', (msg) => {
    alert(msg);
    window.location.reload();
});

socket.on('roomReset', (matrix) => {
    globalMatrix = matrix;
    currentFocusFloor = 0; // Force all connected clients back to floor 1
    updateFocusFloorUI();
    
    for (let f = 0; f < 10; f++) {
        updateCheatsheetRow(f);
    }
    updateMyPathDisplay();
});
