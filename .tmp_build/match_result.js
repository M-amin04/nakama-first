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
exports.matchresult = void 0;
const v = __importStar(require("valibot"));
const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000';
const MatchParticipantSchema = v.object({
    userId: v.string(),
    result: v.string(),
    score: v.number(),
});
const MatchPayloadSchema = v.object({
    gameId: v.string(),
    participants: v.array(MatchParticipantSchema),
});
const matchresult = function (ctx, logger, nk, payload) {
    try {
        const input = JSON.parse(payload || '{}');
        const parsed = v.safeParse(MatchPayloadSchema, input);
        if (!parsed.success) {
            throw { message: 'Invalid argument', code: 3 };
        }
        const { gameId, participants } = parsed.output;
        const gameRecords = nk.storageRead([
            {
                collection: 'games',
                key: gameId,
                userId: SYSTEM_USER_ID,
            },
        ]);
        if (gameRecords.length === 0) {
            throw { message: 'Game is not found', code: 5 };
        }
        const gameConfig = gameRecords[0].value;
        const matchId = nk.uuidv4();
        for (const player of participants) {
            let coinChangeSet = -gameConfig.entryFee;
            if (player.result === 'win') {
                coinChangeSet += gameConfig.winnerReward;
            }
            else if (player.result === 'lose') {
                coinChangeSet += gameConfig.loserReward;
            }
            const changeset = {
                coin: Math.floor(coinChangeSet),
                xp: Math.floor(gameConfig.xp || 0),
            };
            const metadata = {
                matchId: matchId,
                gameName: gameConfig.gameName,
            };
            nk.walletUpdate(player.userId, changeset, metadata, true);
            if (player.result === 'win' && player.score > 0) {
                nk.leaderboardRecordWrite('leaderboard', player.userId, ctx.username, player.score);
            }
        }
        const notifications = participants.map((player) => {
            let coinChangeSet = 0;
            if (player.result === 'win') {
                coinChangeSet += gameConfig.winnerReward;
            }
            else if (player.result === 'lose') {
                coinChangeSet += gameConfig.loserReward;
            }
            return {
                userId: player.userId,
                subject: `Game ${gameConfig.gameName} is over.`,
                content: {
                    matchId: matchId,
                    result: player.result,
                    coins: coinChangeSet,
                },
                code: 1,
                senderId: SYSTEM_USER_ID,
                persistent: true,
                createTime: Math.floor(Date.now() / 1000),
            };
        });
        nk.notificationsSend(notifications);
        nk.storageWrite([
            {
                collection: 'match_history',
                key: matchId,
                userId: SYSTEM_USER_ID,
                value: {
                    matchId,
                    gameId,
                    gameName: gameConfig.gameName,
                    time: Date.now(),
                    players: participants,
                },
                permissionRead: 2,
                permissionWrite: 0,
            },
        ]);
        return JSON.stringify({ success: true, matchId });
    }
    catch (error) {
        logger.error(`Error in matchresult: ${(error === null || error === void 0 ? void 0 : error.message) || error}`);
        if (error && typeof error.code === 'number')
            throw error;
        throw { message: (error === null || error === void 0 ? void 0 : error.message) || String(error), code: 3 };
    }
};
exports.matchresult = matchresult;
