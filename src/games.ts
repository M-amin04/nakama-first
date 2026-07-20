import * as v from 'valibot';
import { NakamaErrorCode, ErrorMessage, handleError } from './utils/error.js';
import { checkUser, checkPayload } from './utils/validator.js';
import { SYSTEM_USER_ID, STORAGE_COLLECTIONS } from './utils/constants.js';

export const setGameConfig: nkruntime.RpcFunction = function (ctx, logger, nk, payload) {
  checkUser(ctx);
  checkPayload(payload);

  try {
    const account = nk.accountGetId(ctx.userId!);
    const metadata = account.user.metadata || {};

    if (metadata.role !== 'admin') {
      throw {
        message: ErrorMessage.ADMIN_ONLY,
        code: NakamaErrorCode.PERMISSION_DENIED,
      };
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
        collection: STORAGE_COLLECTIONS.GAMES,
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
    return handleError(ctx, logger, 'setGameConfig', error);
  }
};

export const getGameConfig: nkruntime.RpcFunction = function (ctx, logger, nk, payload) {
  checkPayload(payload);

  try {
    const GetGameSchema = v.object({
      gameId: v.string(),
    });

    const data = v.parse(GetGameSchema, JSON.parse(payload));

    const records = nk.storageRead([
      {
        collection: STORAGE_COLLECTIONS.GAMES,
        key: data.gameId,
        userId: SYSTEM_USER_ID,
      },
    ]);

    if (records.length === 0) {
      throw {
        message: ErrorMessage.GAME_NOT_FOUND,
        code: NakamaErrorCode.NOT_FOUND,
      };
    }

    return JSON.stringify({
      success: true,
      game: records[0].value,
    });
  } catch (error: any) {
    return handleError(ctx, logger, 'getGameConfig', error);
  }
};
