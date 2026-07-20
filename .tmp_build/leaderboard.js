"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.onLeaderboardReset = void 0;
exports.initLeaderboard = initLeaderboard;
const LEADERBOARD_ID = 'leaderboard';
function initLeaderboard(ctx, logger, nk) {
    try {
        const authoritative = true;
        const sortOrder = "descending";
        const operator = "set";
        const resetSchedule = '0 0 * * 0';
        nk.leaderboardCreate(LEADERBOARD_ID, authoritative, sortOrder, operator, resetSchedule, {});
    }
    catch (error) {
        logger.error(`Error in initLeaderboard: ${(error === null || error === void 0 ? void 0 : error.message) || String(error)}`);
    }
}
const onLeaderboardReset = function (ctx, logger, nk, leaderboard, expiryTime) {
    try {
        if (leaderboard.id !== LEADERBOARD_ID)
            return;
        logger.info(`Leaderboard ${leaderboard.id} has reset. Fetching top 3 players...`);
        const result = nk.leaderboardRecordsList(LEADERBOARD_ID, undefined, 3, undefined, expiryTime);
        const records = result.records || [];
        for (let i = 0; i < records.length; i++) {
            const record = records[i];
            const userId = record.ownerId;
            const changeset = {
                coin: 300,
            };
            const metadata = {
                reason: 'Weekly leaderboard top 3 reward',
            };
            nk.walletUpdate(userId, changeset, metadata, true);
        }
    }
    catch (error) {
        logger.error(`Error in onLeaderboardReset: ${(error === null || error === void 0 ? void 0 : error.message) || String(error)}`);
    }
};
exports.onLeaderboardReset = onLeaderboardReset;
