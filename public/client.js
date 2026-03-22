// State
let globalMatrix = []; // 10 x 4 x 4 (floor x player x platform)
const LOCAL_STORAGE_KEY = 'solorjtracker_matrix';

function initMatrix() {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (saved) {
        try { 
            globalMatrix = JSON.parse(saved); 
            return; 
        } catch (e) {
            console.error("Local storage parsing failed, resetting matrix");
        }
    }
    // Default matrix: 10 floors, 4 players, 4 platforms = 0
    globalMatrix = Array(10).fill([]).map(() => 
        Array(4).fill([]).map(() => Array(4).fill(0))
    );
}

function saveMatrix() {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(globalMatrix));
}

let activeColorIndex = 0; // Current "Paint" color

function initColorBuckets() {
    const buckets = document.querySelectorAll('.color-bucket');
    buckets.forEach(bucket => {
        bucket.addEventListener('click', () => {
            buckets.forEach(b => b.classList.remove('active'));
            bucket.classList.add('active');
            activeColorIndex = parseInt(bucket.dataset.color);
        });
    });
}

// Control Board Elements
const controlBoard = document.getElementById('control-board');
const resetBtn = document.getElementById('reset-btn');

function initControlBoardUI() {
    controlBoard.innerHTML = '';
    
    // Create 10 rows (Floors 10 down to 1)
    for (let f = 9; f >= 0; f--) {
        const rowDiv = document.createElement('div');
        rowDiv.className = 'floor-row';
        rowDiv.id = `floor-${f}`;
        
        // Floor Label
        const labelDiv = document.createElement('div');
        labelDiv.className = 'floor-label';
        labelDiv.innerHTML = `<span class="floor-num">F${f + 1}</span>`;
        rowDiv.appendChild(labelDiv);
        
        const actionDiv = document.createElement('div');
        actionDiv.className = 'action-buttons';
        
        // Platforms (4 per floor)
        for (let pl = 0; pl < 4; pl++) {
            const cellDiv = document.createElement('div');
            cellDiv.className = 'plat-btn';
            cellDiv.id = `btn-f${f}-p${pl}`;
            
            const numSpan = document.createElement('span');
            numSpan.className = 'plat-num';
            numSpan.innerText = pl + 1;
            
            cellDiv.appendChild(numSpan);
            
            cellDiv.addEventListener('click', () => {
                handleCellClick(f, activeColorIndex, pl);
            });
            
            actionDiv.appendChild(cellDiv);
        }
        
        rowDiv.appendChild(actionDiv);
        controlBoard.appendChild(rowDiv);
    }
    renderControlBoardState();
}

function handleCellClick(floor, player, platform) {
    const currentState = globalMatrix[floor][player][platform];
    
    if (currentState === 1) {
        globalMatrix[floor][player][platform] = 0;
    } else {
        // Clear this player's previous location in this floor
        for (let pl = 0; pl < 4; pl++) {
            globalMatrix[floor][player][pl] = 0;
        }
        // Clear this platform's previous owner in this floor
        for (let p = 0; p < 4; p++) {
            globalMatrix[floor][p][platform] = 0;
        }
        
        globalMatrix[floor][player][platform] = 1;
    }
    
    saveMatrix();
    renderControlBoardState();
}

function computeFocusFloor() {
    if (!globalMatrix) return;
    
    let focusF = 0;
    for (let f = 0; f < 10; f++) {
        let sortedPlayers = 0;
        for (let player = 0; player < 4; player++) {
            let hasCorrect = false;
            for (let pl = 0; pl < 4; pl++) {
                if (globalMatrix[f][player][pl] === 1) hasCorrect = true;
            }
            // PQ Romeo and Juliet: usually 3 correct targets per floor needed
            if (hasCorrect) sortedPlayers++;
        }
        
        if (sortedPlayers < 3) {
            focusF = f;
            break;
        }
        if (f === 9 && sortedPlayers >= 3) focusF = 9;
    }

    const rows = document.querySelectorAll('.floor-row');
    rows.forEach(r => {
        r.classList.remove('active-focus', 'completed-layer');
    });

    for (let f = 0; f < focusF; f++) {
        const r = document.getElementById(`floor-${f}`);
        if (r) r.classList.add('completed-layer');
    }
    const activeRow = document.getElementById(`floor-${focusF}`);
    if (activeRow) activeRow.classList.add('active-focus');
}

function renderControlBoardState() {
    for (let f = 0; f < 10; f++) {
        for (let pl = 0; pl < 4; pl++) {
            const cell = document.getElementById(`btn-f${f}-p${pl}`);
            if (!cell) continue;
            
            // clear base classes
            cell.className = 'plat-btn';
            
            // Completely fill the cell if a player occupies it
            for (let player = 0; player < 4; player++) {
                if (globalMatrix[f][player][pl] === 1) {
                    cell.classList.add(`fill-p${player}`);
                    break;
                }
            }
        }
    }
    
    computeFocusFloor();
}

resetBtn.addEventListener('click', () => {
    if (confirm('確定要清除單機面板的所有紀錄嗎？')) {
        globalMatrix = Array(10).fill([]).map(() => 
            Array(4).fill([]).map(() => Array(4).fill(0))
        );
        saveMatrix();
        renderControlBoardState();
    }
});

// App Startup
window.addEventListener('DOMContentLoaded', () => {
    initMatrix();
    initColorBuckets();
    initControlBoardUI();
});
