import * as v from 'valibot';
import { NakamaErrorCode, ErrorMessage, handleError, MatchResultType } from './utils/error.js';
import { SYSTEM_USER_ID, STORAGE_COLLECTIONS, LEADERBOARD_CONFIG } from './utils/constants.js';

const MatchParticipantSchema = v.object({
  userId: v.string(),
  result: v.enum(MatchResultType),
  score: v.number(),
});

const MatchPayloadSchema = v.object({
  gameId: v.string(),
  participants: v.array(MatchParticipantSchema),
});

const calculateReward = (result: MatchResultType, config: any): number => {
  if (result === MatchResultType.WIN) return config.winnerReward || 0;
  if (result === MatchResultType.LOSE) return config.loserReward || 0;
  return 0;
};

export const matchresult: nkruntime.RpcFunction = function (ctx, logger, nk, payload) {
  try {
    const input = JSON.parse(payload || '{}');
    const parsed = v.safeParse(MatchPayloadSchema, input);

    if (!parsed.success) {
      throw {
        message: ErrorMessage.INVALID_ARGUMENT,
        code: NakamaErrorCode.INVALID_ARGUMENT,
      };
    }

    const { gameId, participants } = parsed.output;

    const checkStored = nk.storageRead([
      {
        collection: STORAGE_COLLECTIONS.PROCESSED_GAMES,
        key: gameId,
        userId: SYSTEM_USER_ID,
      },
    ]);

    if (checkStored.length > 0) {
      return JSON.stringify({
        success: true,
        matchId: checkStored[0].value.matchId,
        alreadyProcessed: true,
      });
    }

    const gameRecords = nk.storageRead([
      {
        collection: STORAGE_COLLECTIONS.GAMES,
        key: gameId,
        userId: SYSTEM_USER_ID,
      },
    ]);

    if (gameRecords.length === 0) {
      throw {
        message: ErrorMessage.GAME_NOT_FOUND,
        code: NakamaErrorCode.NOT_FOUND,
      };
    }

    const gameConfig = gameRecords[0].value;
    const matchId = nk.uuidv4();

    nk.storageWrite([
      {
        collection: STORAGE_COLLECTIONS.PROCESSED_GAMES,
        key: gameId,
        userId: SYSTEM_USER_ID,
        value: { matchId, processedAt: Date.now() },
        permissionRead: 0,
        permissionWrite: 0,
      },
    ]);

    for (const player of participants) {
      const reward = calculateReward(player.result, gameConfig);
      const coinChangeSet = reward - (gameConfig.entryFee || 0);

      nk.walletUpdate(
        player.userId,
        {
          coin: Math.floor(coinChangeSet),
          xp: Math.floor(gameConfig.xp || 0),
        },
        { matchId, gameName: gameConfig.gameName },
        true,
      );

      if (player.result === MatchResultType.WIN && player.score > 0) {
        nk.leaderboardRecordWrite(
          LEADERBOARD_CONFIG.ID,
          player.userId,
          player.userId,
          player.score,
        );
      }
    }

    const notifications: nkruntime.NotificationRequest[] = participants.map((player) => ({
      userId: player.userId,
      subject: `Game ${gameConfig.gameName} is over.`,
      content: {
        matchId,
        result: player.result,
        coin: calculateReward(player.result, gameConfig),
      },
      code: 1,
      senderId: SYSTEM_USER_ID,
      persistent: true,
    }));

    nk.notificationsSend(notifications);

    nk.storageWrite([
      {
        collection: STORAGE_COLLECTIONS.MATCH_HISTORY,
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
  } catch (error: any) {
    return handleError(ctx, logger, 'matchresult', error);
  }
};
