const LEADERBOARD_ID = 'leaderboard';

export function initLeaderboard(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
) {
  try {
    const authoritative = true;
    const sortOrder = nkruntime.SortOrder.DESCENDING;
    const operator = nkruntime.Operator.SET;

    const resetSchedule = '0 0 * * 0';

    nk.leaderboardCreate(LEADERBOARD_ID, authoritative, sortOrder, operator, resetSchedule, {});
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
    if (leaderboard.id !== LEADERBOARD_ID) return;

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
  } catch (error: any) {
    logger.error(`Error in onLeaderboardReset: ${error?.message || String(error)}`);
  }
};
