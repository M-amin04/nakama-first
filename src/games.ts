import * as v from 'valibot';
import { handleError } from './utils.js';

const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000';

export const setGameConfig: nkruntime.RpcFunction = function (ctx, logger, nk, payload) {
  if (!ctx.userId) throw new Error('Unauthorized');
  if (!payload) throw new Error('Payload is empty');

  try {
    const account = nk.accountGetId(ctx.userId);
    const metadata = account.user.metadata || {};

    if (metadata.role !== 'admin') {
      throw new Error('Only admin can manage games');
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

    logger.info(`Game ${data.gameName} (${data.gameId}) created/updated by admin.`);
    return JSON.stringify({ success: true });
  } catch (error) {
    return handleError(logger, 'setGameConfig', error);
  }
};

export const getGameConfig: nkruntime.RpcFunction = function (ctx, logger, nk, payload) {
  if (!payload) throw new Error('Payload is empty');

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
      throw new Error('Game not found');
    }

    return JSON.stringify({
      success: true,
      game: records[0].value,
    });
  } catch (error) {
    return handleError(logger, 'getGameConfig', error);
  }
};
