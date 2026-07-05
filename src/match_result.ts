import * as v from 'valibot';

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

export const matchresult: nkruntime.RpcFunction = function (ctx, logger, nk, payload) {
  try {
    const input = JSON.parse(payload || '{}');
    const parsed = v.safeParse(MatchPayloadSchema, input);

    if (!parsed.success) {
      throw { message: 'Invalid argument', code: 3 } as nkruntime.Error;
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
      throw { message: 'Game is not found', code: 5 } as nkruntime.Error;
    }

    const gameConfig = gameRecords[0].value;
    const matchId = nk.uuidv4();

    for (const player of participants) {
      let coinChangeSet = -gameConfig.entryFee;

      if (player.result === 'win') {
        coinChangeSet += gameConfig.winnerReward;
      } else if (player.result === 'lose') {
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

    const notifications: nkruntime.Notification[] = participants.map((player) => {
      let coinChangeSet = -gameConfig.entryFee;
      if (player.result === 'win') {
        coinChangeSet += gameConfig.winnerReward;
      } else if (player.result === 'lose') {
        coinChangeSet += gameConfig.loserReward;
      }

      return {
        id: '',
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
  } catch (error: any) {
    logger.error(`Error in matchresult: ${error?.message || error}`);

    if (error && typeof error.code === 'number') throw error;

    throw { message: error?.message || String(error), code: 3 } as nkruntime.Error;
  }
};
