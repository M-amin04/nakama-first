"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getGameConfig = exports.setGameConfig = void 0;
const v = __importStar(require("valibot"));
const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000';
const setGameConfig = function (ctx, logger, nk, payload) {
    if (!ctx.userId) {
        throw { message: 'Unauthorized', code: 16 };
    }
    if (!payload) {
        throw { message: 'Payload is empty', code: 3 };
    }
    try {
        const account = nk.accountGetId(ctx.userId);
        const metadata = account.user.metadata || {};
        if (metadata.role !== 'admin') {
            throw { message: 'Only admin can\'n manage games', code: 7 };
        }
        const GameSchema = v.object({
            gameId: v.string(),
            gameName: v.string(),
            entryFee: v.number(),
            winnerReward: v.number(),
            loserReward: v.number(),
            maxPlayers: v.number(),
            xp: v.number(),
        });
        const data = v.parse(GameSchema, JSON.parse(payload));
        nk.storageWrite([
            {
                collection: 'games',
                key: data.gameId,
                userId: SYSTEM_USER_ID,
                value: {
                    gameName: data.gameName,
                    entryFee: data.entryFee,
                    winnerReward: data.winnerReward,
                    loserReward: data.loserReward,
                    maxPlayers: data.maxPlayers,
                    xp: data.xp,
                },
                permissionRead: 2,
                permissionWrite: 0,
            },
        ]);
        return JSON.stringify({ success: true });
    }
    catch (error) {
        logger.error(`Error in setGameConfig: ${(error === null || error === void 0 ? void 0 : error.message) || error}`);
        if (error && typeof error.code === 'number')
            throw error;
        throw { message: (error === null || error === void 0 ? void 0 : error.message) || String(error), code: 3 };
    }
};
exports.setGameConfig = setGameConfig;
const getGameConfig = function (ctx, logger, nk, payload) {
    if (!payload) {
        throw { message: 'Payload is empty', code: 3 };
    }
    try {
        const GetGameSchema = v.object({
            gameId: v.string(),
        });
        const data = v.parse(GetGameSchema, JSON.parse(payload));
        const records = nk.storageRead([
            {
                collection: 'games',
                key: data.gameId,
                userId: SYSTEM_USER_ID,
            },
        ]);
        if (records.length === 0) {
            throw { message: 'Game not found', code: 5 };
        }
        return JSON.stringify({
            success: true,
            game: records[0].value,
        });
    }
    catch (error) {
        logger.error(`Error in getGameConfig: ${(error === null || error === void 0 ? void 0 : error.message) || error}`);
        if (error && typeof error.code === 'number')
            throw error;
        throw { message: (error === null || error === void 0 ? void 0 : error.message) || String(error), code: 3 };
    }
};
exports.getGameConfig = getGameConfig;
