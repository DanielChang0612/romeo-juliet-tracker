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

// Accordion & Path Elements
const pathDisplay = document.getElementById('my-path-display');
const accordionBoard = document.getElementById('accordion-board');

// State
let myRoomId = '';
let myPlayerId = -1; 
let playerNames = ['玩家 A', '玩家 B', '玩家 C', '玩家 D'];
let globalMatrix = []; // stores matrix passed from server
let activeAccordionFloor = 0; // 0 to 9

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
        
        initAccordionUI(); // Initialize HTML rows

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
    }
});

// ========= V2 Accordion Logic =========

function initAccordionUI() {
    accordionBoard.innerHTML = '';
    // Build from top to bottom (F10 -> F1)
    for (let f = 9; f >= 0; f--) {
        const row = document.createElement('div');
        row.className = `floor-row ${f === activeAccordionFloor ? 'active' : ''}`;
        row.id = `floor-row-${f}`;

        row.innerHTML = `
            <div class="row-header" onclick="toggleRow(${f})">
                <div class="floor-num">${f + 1}</div>
                <div class="row-platforms" id="preview-${f}">
                    <div class="plat-preview" id="prev-${f}-0">-</div>
                    <div class="plat-preview" id="prev-${f}-1">-</div>
                    <div class="plat-preview" id="prev-${f}-2">-</div>
                    <div class="plat-preview" id="prev-${f}-3">-</div>
                </div>
            </div>
            <div class="row-body">
                <div class="action-buttons-wrapper">
                    <div class="action-buttons">
                        <button class="plat-btn my-plat-btn border-p${myPlayerId}" data-plat="0" onclick="handlePlatformClick(${f}, 0)">1</button>
                        <button class="plat-btn my-plat-btn border-p${myPlayerId}" data-plat="1" onclick="handlePlatformClick(${f}, 1)">2</button>
                        <button class="plat-btn my-plat-btn border-p${myPlayerId}" data-plat="2" onclick="handlePlatformClick(${f}, 2)">3</button>
                        <button class="plat-btn my-plat-btn border-p${myPlayerId}" data-data="3" onclick="handlePlatformClick(${f}, 3)">4</button>
                    </div>
                    <div class="floor-plate"></div>
                </div>
            </div>
        `;
        accordionBoard.appendChild(row);
    }
}

function toggleRow(floor) {
    if (activeAccordionFloor === floor) {
        // Close it
        document.getElementById(`floor-row-${floor}`).classList.remove('active');
        activeAccordionFloor = -1;
    } else {
        if (activeAccordionFloor !== -1 && document.getElementById(`floor-row-${activeAccordionFloor}`)) {
            document.getElementById(`floor-row-${activeAccordionFloor}`).classList.remove('active');
        }
        activeAccordionFloor = floor;
        const newActive = document.getElementById(`floor-row-${floor}`);
        if(newActive) {
            newActive.classList.add('active');
            // Auto scroll to make it visible
            setTimeout(() => {
                newActive.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 100);
        }
    }
}

// Handle physical button click cleanly
function handlePlatformClick(floor, platform) {
    if (!globalMatrix || globalMatrix.length === 0 || myPlayerId === -1) return;
    
    let existingCorrectPlatform = -1;
    for (let i = 0; i < 4; i++) {
        if (globalMatrix[floor][myPlayerId][i] === 1) {
            existingCorrectPlatform = i;
        }
    }

    const val = globalMatrix[floor][myPlayerId][platform];
    let newValue = 1; 
    
    if (val === 1) newValue = -1; 
    else if (val === -1) {
        if (existingCorrectPlatform !== -1) newValue = 1; 
        else newValue = 0; 
    }

    if (newValue === 1 && existingCorrectPlatform !== -1 && existingCorrectPlatform !== platform) {
        socket.emit('updateState', {
            roomId: myRoomId, floor, player: myPlayerId, platform: existingCorrectPlatform, value: 0
        });
    }

    const wasPreviouslyCorrect = (val === 1);
    const willBeCorrect = (newValue === 1);

    socket.emit('updateState', {
        roomId: myRoomId, floor, player: myPlayerId, platform, value: newValue
    });

    if (!wasPreviouslyCorrect && willBeCorrect && floor < 9) {
        setTimeout(() => {
            toggleRow(floor + 1);
        }, 600); // Wait for animations
    }
}

// Render everything to UI
function renderAccordionState() {
    if (!globalMatrix) return;
    
    for (let f = 0; f < 10; f++) {
        const floorMatrix = globalMatrix[f];
        
        for (let pl = 0; pl < 4; pl++) {
            const previewCell = document.getElementById(`prev-${f}-${pl}`);
            if (!previewCell) continue;

            let foundPlayer = -1;
            for (let p = 0; p < 4; p++) {
                if (floorMatrix[p][pl] === 1) foundPlayer = p;
            }

            // Update badge in the collapsed row header (the cheat sheet summary)
            if (foundPlayer !== -1 && playerNames) {
                previewCell.innerHTML = `<span class="cs-badge p${foundPlayer}">${playerNames[foundPlayer]}</span>`;
            } else {
                previewCell.innerText = '-';
            }
            
            // Update the giant button states if inside the row body
            if (myPlayerId !== -1) {
                // query specifically within this floor's action buttons
                // Note data attributes check for handling the 4th button typo
                let btn = document.querySelector(`#floor-row-${f} .my-plat-btn[data-plat="${pl}"]`);
                if (!btn && pl === 3) {
                    btn = document.querySelector(`#floor-row-${f} .my-plat-btn[data-data="${pl}"]`); // handle typo in HTML generator
                }
                
                if (btn) {
                    const myVal = floorMatrix[myPlayerId][pl];
                    btn.classList.remove('state-wrong', 'state-correct');
                    btn.innerHTML = pl + 1; // Default
                    if (myVal === -1) {
                        btn.classList.add('state-wrong');
                        btn.innerHTML = '❌';
                    } else if (myVal === 1) {
                        btn.classList.add('state-correct');
                        btn.innerHTML = '✅';
                    }
                }
            }
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

    renderAccordionState();
    updateMyPathDisplay();

    if (myPlayerId !== -1) {
        displayIdentity.innerText = `我是角色: ${playerNames[myPlayerId]}`;
    }
});

socket.on('namesUpdated', (names) => {
    playerNames = names;
    renderAccordionState();
    if (myPlayerId !== -1) {
        displayIdentity.innerText = `我是角色: ${playerNames[myPlayerId]}`;
    }
});

socket.on('stateUpdated', (data) => {
    const { floor, matrix } = data;
    globalMatrix[floor] = matrix;
    renderAccordionState();
    updateMyPathDisplay();
});

socket.on('joinError', (msg) => {
    alert(msg);
    window.location.reload();
});

socket.on('roomReset', (matrix) => {
    globalMatrix = matrix;
    toggleRow(0); // Pop open floor 1 again on global reset
    renderAccordionState();
    updateMyPathDisplay();
});
