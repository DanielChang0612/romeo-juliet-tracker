const socket = io({
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000
});

// DOM Elements
const loginScreen = document.getElementById('login-screen');
const appScreen = document.getElementById('app-screen');
const roomInput = document.getElementById('room-input');
const playerBtns = document.querySelectorAll('.player-btn');
const joinBtn = document.getElementById('join-btn');
const displayRoom = document.getElementById('display-room');
const displayIdentity = document.getElementById('display-identity');
const resetBtn = document.getElementById('reset-btn');
const backToLobbyBtn = document.getElementById('back-to-lobby-btn');
const connectionStatus = document.getElementById('connection-status');
const appStatus = document.getElementById('app-status');

// Accordion & Path Elements
const pathDisplay = document.getElementById('my-path-display');
const accordionBoard = document.getElementById('accordion-board');

// State
let myRoomId = '';
let myPlayerId = -1; 
let myPlayerName = '';
let playerNames = ['玩家 A', '玩家 B', '玩家 C', '玩家 D'];
let globalMatrix = []; 
let activeAccordionFloor = 0; 
let isInitialJoined = false;

function checkJoinButtonState() {
    const customName = document.getElementById('my-name-input').value.trim();
    if (myPlayerId !== -1 && customName.length > 0) {
        joinBtn.disabled = false;
    } else {
        joinBtn.disabled = true;
    }
}

// 🔥 Session Recovery Login logic
playerBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
        // Prevent clicking locked buttons
        if (e.target.classList.contains('locked')) return;

        playerBtns.forEach(b => b.classList.remove('selected'));
        e.target.classList.add('selected');
        myPlayerId = parseInt(e.target.getAttribute('data-id'));
        checkJoinButtonState();
    });
});

document.getElementById('my-name-input').addEventListener('input', checkJoinButtonState);

document.getElementById('random-room-btn').addEventListener('click', () => {
    roomInput.value = Math.random().toString(36).substring(2, 6).toUpperCase();
    socket.emit('watchRoom', roomInput.value);
});

roomInput.addEventListener('input', () => {
    const rid = roomInput.value.trim().toUpperCase();
    if (rid) socket.emit('watchRoom', rid);
});

function updateStatusUI(online) {
    if (online) {
        if (connectionStatus) connectionStatus.innerHTML = '<span style="color:#10b981">🟢 已連線</span>';
        if (appStatus) appStatus.innerHTML = '<span style="color:#10b981">● 已連線</span>';
    } else {
        if (connectionStatus) connectionStatus.innerHTML = '<span style="color:#f43f5e">🔴 連線失敗 (嘗試恢復中...)</span>';
        if (appStatus) appStatus.innerHTML = '<span style="color:#f43f5e">● 連線斷開</span>';
    }
}

// Socket Lifecycle
socket.on('connect', () => {
    updateStatusUI(true);
    
    // 🔥 Session Persistence Logic
    const savedRoom = localStorage.getItem('rj_last_room');
    const savedId = localStorage.getItem('rj_last_id');
    const savedName = localStorage.getItem('rj_last_name');

    // 1. If we have saved data, pre-fill the UI regardless
    if (savedRoom) roomInput.value = savedRoom;
    if (savedName) document.getElementById('my-name-input').value = savedName;
    
    // We only restore myPlayerId for session recovery if we are already inside the game (isInitialJoined is true)
    // For a fresh load (lobby screen), we want the user to select their role manually.
    if (isInitialJoined && savedId !== null) {
        myPlayerId = parseInt(savedId);
    } else {
        myPlayerId = -1;
        playerBtns.forEach(btn => btn.classList.remove('selected'));
    }

    // Initialize the Join Button state
    checkJoinButtonState();

    // 2. AUTO RE-JOIN ONLY if this is a reconnection (already joined once)
    // If it's the very first load (isInitialJoined is false), we let the user see the login screen
    if (isInitialJoined && savedRoom && savedId !== null) {
        console.log('連線恢復：自動重連房間', savedRoom);
        socket.emit('joinRoom', { 
            roomId: savedRoom, 
            playerId: parseInt(savedId), 
            playerName: savedName || "" 
        });
    } else {
        // Initial load: Sync lobby for the current room input
        const initialRid = roomInput.value.trim().toUpperCase();
        if (initialRid) socket.emit('watchRoom', initialRid);
    }
});

socket.on('disconnect', () => {
    updateStatusUI(false);
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
    if (!customName) {
        alert('請輸入你的遊戲 ID！讓隊友知道你是誰～');
        return;
    }
    
    myRoomId = roomId;
    myPlayerName = customName;

    // Persist session for next refresh/auto-reconnect
    localStorage.setItem('rj_last_room', myRoomId);
    localStorage.setItem('rj_last_id', myPlayerId);
    localStorage.setItem('rj_last_name', myPlayerName);

    executeJoinUI();
});

function executeJoinUI() {
    displayRoom.innerText = myRoomId;
    if (myPlayerName) playerNames[myPlayerId] = myPlayerName;
    displayIdentity.innerText = `我是角色: ${playerNames[myPlayerId]}`;
    displayIdentity.style.color = `var(--color-p${myPlayerId})`;

    loginScreen.classList.remove('active');
    setTimeout(() => {
        loginScreen.classList.add('hidden');
        appScreen.classList.remove('hidden');
        appScreen.classList.add('active');
        initAccordionUI();
        
        socket.emit('joinRoom', { 
            roomId: myRoomId, 
            playerId: myPlayerId, 
            playerName: myPlayerName 
        });
    }, 400);
}

resetBtn.addEventListener('click', () => {
    if (confirm('確定要同步重置整個房間的紀錄嗎？')) {
        socket.emit('resetRoom', myRoomId);
    }
});

if (backToLobbyBtn) {
    backToLobbyBtn.addEventListener('click', () => {
        if (confirm('確定要退回大廳選單嗎？這將會釋放您當前的角色位置。')) {
            // Clear last room and ID to prevent auto-reconnection
            localStorage.removeItem('rj_last_room');
            localStorage.removeItem('rj_last_id');
            window.location.reload();
        }
    });
}

// ========= Accordion Logic =========

function initAccordionUI() {
    accordionBoard.innerHTML = '';
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
                        <button class="plat-btn my-plat-btn border-p${myPlayerId}" data-plat="0" 
                            onmousedown="handlePlatformStart(event, ${f}, 0)" 
                            onmouseup="handlePlatformEnd(event, ${f}, 0)"
                            onmouseleave="handlePlatformCancel(event)"
                            ontouchstart="handlePlatformStart(event, ${f}, 0)" 
                            ontouchend="handlePlatformEnd(event, ${f}, 0)"
                            ontouchcancel="handlePlatformCancel(event)"
                            onclick="handlePlatformClick(${f}, 0)">1</button>
                        <button class="plat-btn my-plat-btn border-p${myPlayerId}" data-plat="1" 
                            onmousedown="handlePlatformStart(event, ${f}, 1)" 
                            onmouseup="handlePlatformEnd(event, ${f}, 1)"
                            onmouseleave="handlePlatformCancel(event)"
                            ontouchstart="handlePlatformStart(event, ${f}, 1)" 
                            ontouchend="handlePlatformEnd(event, ${f}, 1)"
                            ontouchcancel="handlePlatformCancel(event)"
                            onclick="handlePlatformClick(${f}, 1)">2</button>
                        <button class="plat-btn my-plat-btn border-p${myPlayerId}" data-plat="2" 
                            onmousedown="handlePlatformStart(event, ${f}, 2)" 
                            onmouseup="handlePlatformEnd(event, ${f}, 2)"
                            onmouseleave="handlePlatformCancel(event)"
                            ontouchstart="handlePlatformStart(event, ${f}, 2)" 
                            ontouchend="handlePlatformEnd(event, ${f}, 2)"
                            ontouchcancel="handlePlatformCancel(event)"
                            onclick="handlePlatformClick(${f}, 2)">3</button>
                        <button class="plat-btn my-plat-btn border-p${myPlayerId}" data-plat="3" 
                            onmousedown="handlePlatformStart(event, ${f}, 3)" 
                            onmouseup="handlePlatformEnd(event, ${f}, 3)"
                            onmouseleave="handlePlatformCancel(event)"
                            ontouchstart="handlePlatformStart(event, ${f}, 3)" 
                            ontouchend="handlePlatformEnd(event, ${f}, 3)"
                            ontouchcancel="handlePlatformCancel(event)"
                            onclick="handlePlatformClick(${f}, 3)">4</button>
                    </div>
                </div>
            </div>
        `;
        accordionBoard.appendChild(row);
    }
    renderAccordionState();
}

function toggleRow(floor) {
    if (activeAccordionFloor === floor) {
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
            setTimeout(() => {
                newActive.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 100);
        }
    }
}

// ========= Option B Long Press & Click Logic =========
let longPressTimer = null;
let isLongPressActive = false;

function handlePlatformStart(e, floor, platform) {
    if (e.type === 'mousedown' && e.button !== 0) return;
    
    isLongPressActive = false;
    clearTimeout(longPressTimer);
    
    longPressTimer = setTimeout(() => {
        isLongPressActive = true;
        handlePlatformLongPress(floor, platform);
        if (navigator.vibrate) navigator.vibrate(50);
    }, 600); // 0.6 seconds long press
}

function handlePlatformEnd(e, floor, platform) {
    clearTimeout(longPressTimer);
    if (isLongPressActive) {
        e.preventDefault();
        isLongPressActive = false;
    }
}

function handlePlatformCancel(e) {
    clearTimeout(longPressTimer);
}

function handlePlatformLongPress(floor, platform) {
    if (!globalMatrix || globalMatrix.length === 0 || myPlayerId === -1) return;

    const val = globalMatrix[floor][myPlayerId][platform];
    let newValue = -1; // Default to Wrong (❌)
    
    if (val === -1) {
        newValue = 0; // If already wrong, clear to blank (0)
    }

    socket.emit('updateState', {
        roomId: myRoomId, floor, player: myPlayerId, platform, value: newValue
    });
}

function handlePlatformClick(floor, platform) {
    if (!globalMatrix || globalMatrix.length === 0 || myPlayerId === -1) return;
    
    let existingCorrectPlatform = -1;
    for (let i = 0; i < 4; i++) {
        if (globalMatrix[floor][myPlayerId][i] === 1) {
            existingCorrectPlatform = i;
        }
    }

    const val = globalMatrix[floor][myPlayerId][platform];
    let newValue = 1; // Default to correct ✅
    
    if (val === 1) {
        newValue = 0; // If already correct, clear to blank (0)
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
        }, 600); 
    }
}

function renderAccordionState() {
    if (!globalMatrix || globalMatrix.length === 0) return;
    
    for (let f = 0; f < 10; f++) {
        const floorMatrix = globalMatrix[f];
        for (let pl = 0; pl < 4; pl++) {
            const previewCell = document.getElementById(`prev-${f}-${pl}`);
            if (!previewCell) continue;

            let foundPlayer = -1;
            for (let p = 0; p < 4; p++) {
                if (floorMatrix[p][pl] === 1) foundPlayer = p;
            }

            if (foundPlayer !== -1) {
                previewCell.innerHTML = `<span class="cs-badge p${foundPlayer}">${playerNames[foundPlayer]}</span>`;
            } else {
                previewCell.innerText = '-';
            }
            
            if (myPlayerId !== -1) {
                let btn = document.querySelector(`#floor-row-${f} .my-plat-btn[data-plat="${pl}"]`);
                if (btn) {
                    const myVal = floorMatrix[myPlayerId][pl];
                    btn.classList.remove('state-wrong', 'state-correct');
                    btn.innerHTML = pl + 1; 
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
            if (floorMatrix[myPlayerId][pl] === 1) found = (pl + 1).toString();
        }
        htmlStr += found;
        if (f === 4) htmlStr += "&nbsp;&nbsp;&nbsp;";
        else if (f < 9) htmlStr += "&nbsp;";
    }
    if (pathDisplay) pathDisplay.innerHTML = htmlStr;
}

// Socket listening
socket.on('initialState', (data) => {
    const { matrix, names, taken } = data;
    playerNames = names;
    globalMatrix = matrix;
    
    renderTeamHUD(taken, names);

    // Check if we need to switch from login to app screen
    if (!isInitialJoined) {
        if (loginScreen.classList.contains('active')) {
            executeJoinUI();
        }
        isInitialJoined = true;
    }

    renderAccordionState();
    updateMyPathDisplay();

    if (myPlayerId !== -1) {
        displayIdentity.innerText = `我是角色: ${playerNames[myPlayerId]}`;
    }
});

socket.on('namesUpdated', (names) => {
    playerNames = names;
    socket.emit('requestTakenStatus');
    renderAccordionState();
    if (myPlayerId !== -1) displayIdentity.innerText = `我是角色: ${playerNames[myPlayerId]}`;
});

socket.on('stateUpdated', (data) => {
    const { floor, matrix } = data;
    globalMatrix[floor] = matrix;
    renderAccordionState();
    updateMyPathDisplay();
});

socket.on('joinError', (msg) => {
    alert(msg);
    // If auto-joining failed, clear it
    localStorage.removeItem('rj_last_room');
    window.location.reload();
});

socket.on('playersUpdated', (data) => {
    const { taken, names } = data;
    playerNames = names; // Store locally for display
    
    playerBtns.forEach((btn, idx) => {
        const info = document.getElementById(`slot-info-${idx}`);
        const charLabel = String.fromCharCode(65 + idx); // A, B, C, D
        btn.innerText = `角色 ${charLabel}`;
        
        if (taken[idx]) {
            // IF we have already successfully joined the room, and it's our slot
            if (isInitialJoined && myPlayerId === idx) {
                btn.classList.remove('locked');
                btn.disabled = false;
                if (info) info.innerHTML = `<span style="color:var(--color-p${idx})">是你本人 🙋</span>`;
            } else {
                // Otherwise, someone else is occupying it on the server
                btn.classList.add('locked');
                btn.disabled = true;
                if (info) info.innerHTML = `<span style="color:var(--color-p${idx})">${names[idx]}</span> 已進入`;
                
                // If this slot was pre-selected in the lobby, deselect it
                if (!isInitialJoined && myPlayerId === idx) {
                    btn.classList.remove('selected');
                    myPlayerId = -1;
                }
            }
        } else {
            // NO ONE here
            btn.classList.remove('locked');
            btn.disabled = false;
            if (info) info.innerText = "候選中...";
        }
    });

    // Update the Join Button state in case the currently selected role was deselected
    checkJoinButtonState();

    renderTeamHUD(taken, names);
});

// Toggle Detailed Team List
document.getElementById('toggle-members-btn').addEventListener('click', () => {
    const hud = document.getElementById('team-hud');
    hud.classList.toggle('hidden');
});

function renderTeamHUD(taken, names) {
    const hud = document.getElementById('team-hud');
    if (!hud) return;
    hud.innerHTML = '';
    
    for (let i = 0; i < 4; i++) {
        const slot = document.createElement('div');
        const isOnline = taken[i];
        const isMe = (i === myPlayerId);
        
        // Update Mini Status Grid (the dots under Identity)
        const miniDot = document.getElementById(`mini-dot-${i}`);
        if (miniDot) {
            if (isOnline) miniDot.classList.add('active');
            else miniDot.classList.remove('active');
        }

        slot.className = `team-member p${i} ${isOnline ? 'online' : 'offline'} ${isMe ? 'is-me' : ''}`;
        slot.innerHTML = `
            <div class="member-dot"></div>
            <div class="member-name">${names[i]} ${isMe ? '(你)' : ''}</div>
        `;
        hud.appendChild(slot);
    }
}

socket.on('roomReset', (matrix) => {
    globalMatrix = matrix;
    toggleRow(0); 
    renderAccordionState();
    updateMyPathDisplay();
});
