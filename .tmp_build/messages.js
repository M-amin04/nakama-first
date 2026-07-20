"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpCode = exports.Mark = void 0;
var Mark;
(function (Mark) {
    Mark[Mark["UNDEFINED"] = 0] = "UNDEFINED";
    Mark[Mark["X"] = 1] = "X";
    Mark[Mark["O"] = 2] = "O";
})(Mark || (exports.Mark = Mark = {}));
var OpCode;
(function (OpCode) {
    OpCode[OpCode["START"] = 1] = "START";
    OpCode[OpCode["UPDATE"] = 2] = "UPDATE";
    OpCode[OpCode["DONE"] = 3] = "DONE";
    OpCode[OpCode["MOVE"] = 4] = "MOVE";
    OpCode[OpCode["REJECTED"] = 5] = "REJECTED";
    OpCode[OpCode["OPPONENT_LEFT"] = 6] = "OPPONENT_LEFT";
    OpCode[OpCode["INVITE_AI"] = 7] = "INVITE_AI";
})(OpCode || (exports.OpCode = OpCode = {}));
