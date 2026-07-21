import { LEADERBOARD_CONFIG } from './utils/constants.js';

export function initLeaderboard(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
) {
  try {
    nk.leaderboardCreate(
      LEADERBOARD_CONFIG.ID,
      true,
      nkruntime.SortOrder.DESCENDING,
      nkruntime.Operator.SET,
      LEADERBOARD_CONFIG.RESET_SCHEDULE,
      {},
    );
  } catch (error: any) {
    logger.error(`Error in initLeaderboard: ${error?.message || String(error)}`);
  }
}

export const onLeaderboardReset: nkruntime.LeaderboardResetFunction = function (
  ctx,
  logger,
  nk,
  leaderboard,
  expiryTime,
) {
  try {
    if (leaderboard.id !== LEADERBOARD_CONFIG.ID) return;

    const result = nk.leaderboardRecordsList(
      LEADERBOARD_CONFIG.ID,
      undefined,
      3,
      undefined,
      expiryTime,
    );

    const records = result.records || [];

    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      const userId = record.ownerId;

      const coinReward = LEADERBOARD_CONFIG.TOP_REWARDS[i] || 100;

      nk.walletUpdate(
        userId,
        { coin: coinReward },
        { reason: `Weekly leaderboard rank ${i + 1} reward.` },
        true,
      );
    }
  } catch (error: any) {
    logger.error(`Error in onLeaderboardReset: ${error?.message || String(error)}`);
  }
};
