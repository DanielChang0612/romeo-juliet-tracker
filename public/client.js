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
const randomRoomBtn = document.getElementById('random-room-btn');
const copyLinkBtn = document.getElementById('copy-link-btn');

// Control Board & Path Elements
const pathDisplay = document.getElementById('my-path-display');
const controlBoard = document.getElementById('control-board');

// State
let myRoomId = '';
let myPlayerId = -1; 
let playerNames = ['玩家 A', '玩家 B', '玩家 C', '玩家 D'];
let globalMatrix = []; // stores matrix passed from server
let watchTimeout = null; // Added

// Check URL for Room Invite Code On Load
window.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get('room');
    if (roomParam) {
        // const roomInput = document.getElementById('room-input'); // roomInput is already defined globally
        if (roomInput) {
            roomInput.value = roomParam.toUpperCase();
            setTimeout(() => {
                socket.emit('watchRoom', roomParam.toUpperCase());
            }, 100);
        }
    }
});

// Login logic
playerBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
        playerBtns.forEach(b => b.classList.remove('selected'));
        e.target.classList.add('selected');
        myPlayerId = parseInt(e.target.getAttribute('data-id'));
    });
});

// New input listener for roomInput
roomInput.addEventListener('input', (e) => {
    e.target.value = e.target.value.toUpperCase();
    const val = e.target.value.trim();
    
    clearTimeout(watchTimeout);
    watchTimeout = setTimeout(() => {
        if (val.length >= 4) {
            socket.emit('watchRoom', val);
        } else {
            // clear taken status locally if input relates to nothing
            updateLobbyPlayerBtns([false, false, false, false]);
        }
    }, 300);
});

// Modified random room button listener
randomRoomBtn.addEventListener('click', () => {
    roomInput.value = Math.random().toString(36).substring(2, 6).toUpperCase();
});

// copyLinkBtn is now defined globally
if (copyLinkBtn) {
    copyLinkBtn.addEventListener('click', () => {
        const roomCode = roomInput.value.trim().toUpperCase();
        if (!roomCode) {
            alert('請先輸入或隨機產生房間代號再複製！');
            return;
        }
        
        // Base URL excluding search query or hash
        const baseUrl = window.location.origin + window.location.pathname;
        const inviteUrl = `${baseUrl}?room=${roomCode}`;
        
        navigator.clipboard.writeText(inviteUrl).then(() => {
            const originalText = copyLinkBtn.innerText;
            copyLinkBtn.innerText = '✅ 已複製';
            setTimeout(() => { copyLinkBtn.innerText = originalText; }, 2000);
        }).catch(err => {
            alert('無法複製到剪貼簿，請手動複製 URL。');
        });
    });
}

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
        
        initControlBoardUI(); // Initialize HTML rows

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

// ========= V3 Control Board Logic =========

function initControlBoardUI() {
    controlBoard.innerHTML = '';
    // Build from top to bottom (F10 -> F1)
    for (let f = 9; f >= 0; f--) {
        const row = document.createElement('div');
        row.className = 'floor-row';
        row.id = `floor-row-${f}`;

        row.innerHTML = `
            <div class="floor-num" onclick="computeFocusFloor()">F${f + 1}</div>
            <div class="action-buttons">
                <button class="plat-btn my-plat-btn border-p${myPlayerId}" data-plat="0" onclick="handlePlatformClick(${f}, 0)">1</button>
                <button class="plat-btn my-plat-btn border-p${myPlayerId}" data-plat="1" onclick="handlePlatformClick(${f}, 1)">2</button>
                <button class="plat-btn my-plat-btn border-p${myPlayerId}" data-plat="2" onclick="handlePlatformClick(${f}, 2)">3</button>
                <button class="plat-btn my-plat-btn border-p${myPlayerId}" data-plat="3" onclick="handlePlatformClick(${f}, 3)">4</button>
            </div>
        `;
        controlBoard.appendChild(row);
    }
}

function computeFocusFloor() {
    if (!globalMatrix) return;
    
    // Find lowest floor (0 to 9) that is NOT completed BY ME
    let targetFloor = 0;
    for (let f = 0; f < 10; f++) {
        let isCompletedByMe = false;
        
        if (myPlayerId !== -1) {
            // Check if I have a ✅ (1) on ANY platform
            for (let pl = 0; pl < 4; pl++) {
                if (globalMatrix[f][myPlayerId][pl] === 1) isCompletedByMe = true;
            }
        }
        
        const row = document.getElementById(`floor-row-${f}`);
        if (!row) continue;
        
        row.classList.remove('active-focus', 'completed-layer');
        if (isCompletedByMe) {
            row.classList.add('completed-layer');
            targetFloor = f + 1; // Since I completed it, jump my focus to next
        }
    }
    
    if (targetFloor > 9) targetFloor = 9; // Cap at 10th floor
    
    for (let f = 0; f < 10; f++) {
        const row = document.getElementById(`floor-row-${f}`);
        if(row && f === targetFloor) row.classList.add('active-focus');
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

    socket.emit('updateState', {
        roomId: myRoomId, floor, player: myPlayerId, platform, value: newValue
    });
}

// Render everything to UI
function renderControlBoardState() {
    if (!globalMatrix) return;
    
    for (let f = 0; f < 10; f++) {
        const floorMatrix = globalMatrix[f];
        
        for (let pl = 0; pl < 4; pl++) {
            const btn = document.querySelector(`#floor-row-${f} .my-plat-btn[data-plat="${pl}"]`);
            if (!btn) continue;
            
            // 1. Is it globally correct?
            let globalCorrectPlayer = -1;
            for (let p = 0; p < 4; p++) {
                if (floorMatrix[p][pl] === 1) globalCorrectPlayer = p;
            }
            
            // Reset state logically
            btn.className = `plat-btn my-plat-btn border-p${myPlayerId !== -1 ? myPlayerId : 0}`;
            btn.innerHTML = pl + 1;
            
            if (globalCorrectPlayer !== -1) {
                // Fill color entirely, no numbers shown
                btn.classList.add('state-correct', `btn-bg-p${globalCorrectPlayer}`);
                btn.innerHTML = '';
            } else if (myPlayerId !== -1) {
                // Not globally correct. Check MY state
                const myVal = floorMatrix[myPlayerId][pl];
                if (myVal === -1) {
                    btn.classList.add('state-wrong');
                    btn.innerHTML = '❌';
                }
            }
        }
    }
    computeFocusFloor();
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

function showSlackerAlert(playerId) {
    const banner = document.getElementById('slacker-banner');
    if (!banner) return;
    const name = playerNames ? playerNames[playerId] : `玩家 ${playerId}`;
    banner.innerText = `🤣 [${name}] 在偷懶等答案嚕！`;
    
    // Reset and assign player-specific border color
    banner.className = `slacker-banner p${playerId}-border show`;
    
    // Set absolute timeout, clear previous
    if(window.slackerTimer) clearTimeout(window.slackerTimer);
    window.slackerTimer = setTimeout(() => {
        banner.className = 'slacker-banner';
    }, 5000);
}

// Socket listening
socket.on('initialState', (data) => {
    const { matrix, names } = data;
    playerNames = names;
    globalMatrix = matrix;

    renderControlBoardState();
    updateMyPathDisplay();

    if (myPlayerId !== -1) {
        displayIdentity.innerText = `我是角色: ${playerNames[myPlayerId]}`;
    }
});

socket.on('namesUpdated', (names) => {
    playerNames = names;
    renderControlBoardState();
    if (myPlayerId !== -1) {
        displayIdentity.innerText = `我是角色: ${playerNames[myPlayerId]}`;
    }
});

socket.on('stateUpdated', (data) => {
    const { floor, matrix } = data;
    
    // Diff logic for slacker alert before replacing globalMatrix
    let correctBefore = 0;
    for(let p=0; p<4; p++) {
        for(let pl=0; pl<4; pl++) {
            if(globalMatrix[floor] && globalMatrix[floor][p][pl] === 1) correctBefore++;
        }
    }
    
    let correctAfter = 0;
    let newlyCorrectPlayer = -1;
    for(let p=0; p<4; p++) {
        for(let pl=0; pl<4; pl++) {
            if(matrix[p][pl] === 1) {
                correctAfter++;
                if (globalMatrix[floor] && globalMatrix[floor][p][pl] !== 1) {
                    newlyCorrectPlayer = p;
                }
            }
        }
    }
    
    console.log(`[SLACKER CHECK F${floor+1}] Before: ${correctBefore}, After: ${correctAfter}, New P: ${newlyCorrectPlayer}`);
    if (correctBefore < 4 && correctAfter >= 4 && newlyCorrectPlayer !== -1) {
        showSlackerAlert(newlyCorrectPlayer);
    }
    
    globalMatrix[floor] = matrix;
    renderControlBoardState();
    updateMyPathDisplay();
});

function updateLobbyPlayerBtns(takenStatus, names) {
    const loginScreen = document.getElementById('login-screen');
    if (loginScreen && loginScreen.classList.contains('active')) {
        for (let i = 0; i < 4; i++) {
            const btn = document.querySelector(`.player-btn[data-id="${i}"]`);
            if (btn) {
                if (takenStatus[i]) {
                    btn.classList.add('taken');
                    btn.disabled = true;
                    if (myPlayerId === i) {
                        btn.classList.remove('selected');
                        myPlayerId = -1;
                    }
                    if (names && names[i]) {
                        btn.setAttribute('data-taken-name', names[i]);
                    }
                } else {
                    btn.classList.remove('taken');
                    btn.disabled = false;
                    btn.removeAttribute('data-taken-name');
                }
            }
        }
    }
}

socket.on('namesUpdated', (names) => {
    playerNames = names;
    // can also trigger UI update if needed
    socket.emit('requestTakenStatus'); // optional, let playersUpdated handle it
});

socket.on('playersUpdated', (payload) => {
    // Check if payload is the new object { taken, names } or old array
    let takenStatus = Array.isArray(payload) ? payload : payload.taken;
    let names = Array.isArray(payload) ? null : payload.names;

    // header dots
    for (let i = 0; i < 4; i++) {
        const dot = document.getElementById(`dot-p${i}`);
        if (dot) {
            if (takenStatus[i]) dot.classList.add(`active-p${i}`);
            else dot.classList.remove(`active-p${i}`);
        }
    }
    
    updateLobbyPlayerBtns(takenStatus, names);
});

socket.on('joinError', (msg) => {
    alert(msg);
    window.location.reload();
});

socket.on('roomReset', (matrix) => {
    globalMatrix = matrix;
    renderControlBoardState();
    updateMyPathDisplay();
});
