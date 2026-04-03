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

// 🔥 Session Recovery Login logic
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
    
    // 🔥 AUTO RE-JOIN Logic
    const savedRoom = localStorage.getItem('rj_last_room');
    const savedId = localStorage.getItem('rj_last_id');
    const savedName = localStorage.getItem('rj_last_name');

    if (savedRoom && savedId !== null) {
        console.log('嘗試自動恢復房間:', savedRoom);
        socket.emit('joinRoom', { 
            roomId: savedRoom, 
            playerId: parseInt(savedId), 
            playerName: savedName || "" 
        });
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
                        <button class="plat-btn my-plat-btn border-p${myPlayerId}" data-plat="0" onclick="handlePlatformClick(${f}, 0)">1</button>
                        <button class="plat-btn my-plat-btn border-p${myPlayerId}" data-plat="1" onclick="handlePlatformClick(${f}, 1)">2</button>
                        <button class="plat-btn my-plat-btn border-p${myPlayerId}" data-plat="2" onclick="handlePlatformClick(${f}, 2)">3</button>
                        <button class="plat-btn my-plat-btn border-p${myPlayerId}" data-plat="3" onclick="handlePlatformClick(${f}, 3)">4</button>
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
    const { matrix, names } = data;
    playerNames = names;
    globalMatrix = matrix;

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

socket.on('roomReset', (matrix) => {
    globalMatrix = matrix;
    toggleRow(0); 
    renderAccordionState();
    updateMyPathDisplay();
});
