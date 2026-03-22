const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');

app.use(express.static(path.join(__dirname, 'public')));

// Store room state in memory
const rooms = {};

// floor: 0-9
// player: 0-3 (A, B, C, D)
// platform: 0-3 (1, 2, 3, 4)
// values: 0 = unknown, 1 = correct, -1 = wrong

function getInitialMatrix() {
    return Array(10).fill(null).map(() => 
        Array(4).fill(null).map(() => Array(4).fill(0))
    );
}

function getInitialRoom() {
    return {
        matrix: getInitialMatrix(),
        manualMatrix: getInitialMatrix(),
        names: ['玩家 A', '玩家 B', '玩家 C', '玩家 D'],
        taken: [null, null, null, null]
    };
}

function runDeduction(matrix, floor) {
    let changed = false;
    do {
        changed = false;
        const currentFloor = matrix[floor];
        
        // Rule 1: check rows (players). If a player has 3 wrongs, the 4th is correct.
        for (let p = 0; p < 4; p++) {
            let wrongs = 0;
            let unknownIdx = -1;
            for (let pl = 0; pl < 4; pl++) {
                if (currentFloor[p][pl] === -1) wrongs++;
                else if (currentFloor[p][pl] === 0) unknownIdx = pl;
            }
            if (wrongs === 3 && unknownIdx !== -1) {
                currentFloor[p][unknownIdx] = 1;
                changed = true;
            }
        }

        // Rule 2: check cols (platforms). If a platform has 3 wrongs, the 4th player is correct.
        for (let pl = 0; pl < 4; pl++) {
            let wrongs = 0;
            let unknownIdx = -1;
            for (let p = 0; p < 4; p++) {
                if (currentFloor[p][pl] === -1) wrongs++;
                else if (currentFloor[p][pl] === 0) unknownIdx = p;
            }
            if (wrongs === 3 && unknownIdx !== -1) {
                currentFloor[unknownIdx][pl] = 1;
                changed = true;
            }
        }

        // Rule 3: Propagation. If a cell is correct (1), other cells in its row and col are wrong (-1).
        for (let p = 0; p < 4; p++) {
            for (let pl = 0; pl < 4; pl++) {
                if (currentFloor[p][pl] === 1) {
                    // Set other platforms for this player to wrong
                    for (let otherPl = 0; otherPl < 4; otherPl++) {
                        if (otherPl !== pl && currentFloor[p][otherPl] === 0) {
                            currentFloor[p][otherPl] = -1;
                            changed = true;
                        }
                    }
                    // Set other players for this platform to wrong
                    for (let otherP = 0; otherP < 4; otherP++) {
                        if (otherP !== p && currentFloor[otherP][pl] === 0) {
                            currentFloor[otherP][pl] = -1;
                            changed = true;
                        }
                    }
                }
            }
        }
    } while (changed);
}

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('joinRoom', ({ roomId, playerId, playerName }) => {
        if (!rooms[roomId]) {
            rooms[roomId] = getInitialRoom();
        }
        
        // Slot Locking check
        if (rooms[roomId].taken[playerId] && rooms[roomId].taken[playerId] !== socket.id) {
            socket.emit('joinError', '抱歉！這個角色已經被其他人選走囉！請換一個角色登入。');
            return;
        }

        socket.join(roomId);
        rooms[roomId].taken[playerId] = socket.id;
        socket.roomId = roomId;
        socket.playerId = playerId;

        if (playerId >= 0 && playerId < 4 && playerName && playerName.trim() !== '') {
            rooms[roomId].names[playerId] = playerName.substring(0, 10);
        }
        socket.emit('initialState', {
            matrix: rooms[roomId].matrix,
            names: rooms[roomId].names
        });
        socket.to(roomId).emit('namesUpdated', rooms[roomId].names);
    });

    socket.on('updateState', ({ roomId, floor, player, platform, value }) => {
        if (!rooms[roomId]) return;
        
        const room = rooms[roomId];
        room.manualMatrix[floor][player][platform] = value;

        // Rebuild display matrix strictly from manual inputs
        room.matrix[floor] = JSON.parse(JSON.stringify(room.manualMatrix[floor]));

        // Run deduction engine on this fresh floor
        runDeduction(room.matrix, floor);

        // Broadcast to everyone in the room
        io.to(roomId).emit('stateUpdated', { 
            floor, 
            matrix: room.matrix[floor] 
        });
    });

    socket.on('resetRoom', (roomId) => {
        if (!rooms[roomId]) return;
        rooms[roomId].matrix = getInitialMatrix();
        rooms[roomId].manualMatrix = getInitialMatrix();
        io.to(roomId).emit('roomReset', rooms[roomId].matrix);
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        if (socket.roomId && rooms[socket.roomId]) {
            if (socket.playerId !== undefined) {
                rooms[socket.roomId].taken[socket.playerId] = null;
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
