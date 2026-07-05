import * as v from 'valibot';

const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000';

export const setGameConfig: nkruntime.RpcFunction = function (ctx, logger, nk, payload) {
  if (!ctx.userId) {
    throw { message: 'Unauthorized', code: 16 } as nkruntime.Error;
  }
  if (!payload) {
    throw { message: 'Payload is empty', code: 3 } as nkruntime.Error;
  }

  try {
    const account = nk.accountGetId(ctx.userId);
    const metadata = account.user.metadata || {};

    if (metadata.role !== 'admin') {
      throw { message: 'Only admin can manage games', code: 7 } as nkruntime.Error;
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
  } catch (error: any) {
    logger.error(`Error in setGameConfig: ${error?.message || error}`);

    if (error && typeof error.code === 'number') throw error;

    throw { message: error?.message || String(error), code: 3 } as nkruntime.Error;
  }
};

export const getGameConfig: nkruntime.RpcFunction = function (ctx, logger, nk, payload) {
  if (!payload) {
    throw { message: 'Payload is empty', code: 3 } as nkruntime.Error;
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
      throw { message: 'Game not found', code: 5 } as nkruntime.Error;
    }

    return JSON.stringify({
      success: true,
      game: records[0].value,
    });
  } catch (error: any) {
    logger.error(`Error in getGameConfig: ${error?.message || error}`);

    if (error && typeof error.code === 'number') throw error;

    throw { message: error?.message || String(error), code: 3 } as nkruntime.Error;
  }
};
