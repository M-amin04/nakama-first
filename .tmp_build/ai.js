"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.aiPresence = exports.aiUserId = void 0;
exports.aiTurn = aiTurn;
const messages_js_1 = require("./messages.js");
exports.aiUserId = 'ai-user-id';
const tfServingAddress = 'http://tf:8501/v1/models/ttt:predict';
exports.aiPresence = {
    userId: exports.aiUserId,
    sessionId: '',
    username: exports.aiUserId,
    node: '',
};
function aiMessage(code, data) {
    return {
        sender: exports.aiPresence,
        persistence: true,
        status: '',
        opCode: code,
        data: data,
        reliable: true,
        receiveTimeMs: Date.now(),
    };
}
function aiTurn(state, logger, nk) {
    let aiCell = [1, 0];
    let playerCell = [0, 1];
    let undefCell = [0, 0];
    let b = [
        [undefCell, undefCell, undefCell],
        [undefCell, undefCell, undefCell],
        [undefCell, undefCell, undefCell],
    ];
    state.board.forEach((mark, idx) => {
        const rowIdx = Math.floor(idx / 3);
        const cellIdx = idx % 3;
        if (mark === state.marks[exports.aiUserId])
            b[rowIdx][cellIdx] = aiCell;
        else if (mark === null || mark === messages_js_1.Mark.UNDEFINED)
            b[rowIdx][cellIdx] = undefCell;
        else
            b[rowIdx][cellIdx] = playerCell;
    });
    let headers = { Accept: 'application/json' };
    let resp = nk.httpRequest(tfServingAddress, 'post', headers, JSON.stringify({ instances: [b] }));
    let body = JSON.parse(resp.body);
    let predictions = [];
    try {
        predictions = body.predictions[0];
    }
    catch (error) {
        logger.error('received unexpected TF response: %v: %v', error, body);
        return;
    }
    let maxVal = -Infinity;
    let aiMovePos = -1;
    predictions.forEach((val, idx) => {
        if (val > maxVal) {
            maxVal = val;
            aiMovePos = idx;
        }
    });
    if (aiMovePos > -1) {
        let move = nk.stringToBinary(JSON.stringify({ position: aiMovePos }));
        state.aiMessage = aiMessage(messages_js_1.OpCode.MOVE, move);
    }
}
