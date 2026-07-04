import * as v from 'valibot';
import { handleError } from './utils.js';

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

    if (!parsed.success) throw Error('Invalid argument');

    const { gameId, participants } = parsed.output;

    const gameRecords = nk.storageRead([
      {
        collection: 'games',
        key: gameId,
        userId: '00000000-0000-0000-0000-000000000000',
      },
    ]);

    if (gameRecords.length === 0) throw Error('Game is not found');

    const gameConfig = gameRecords[0].value;
    const matchId = nk.uuidv4();

    for (const player of participants) {
      let coinChangeSet = -gameConfig.entryFee;

      if (player.result === 'win') {
        coinChangeSet += gameConfig.winReward;
      } else if (player.result === 'lose') {
        coinChangeSet += gameConfig.loseReward;
      }

      const changeset = {
        coins: coinChangeSet,
        xp: gameConfig.xpReward,
      };

      const metadata = {
        matchId: matchId,
        gameName: gameConfig.name,
      };

      nk.walletUpdate(player.userId, changeset, metadata, true);

      if (player.result === 'win' && player.score > 0) {
        nk.leaderboardRecordWrite(
          'weekly_coins_leaderboard',
          player.userId,
          ctx.username,
          player.score,
        );
      }

      nk.notificationSend(
        player.userId,
        `Game ${gameConfig.name} is over.`,
        { result: player.result, coins: coinChangeSet },
        1,
        '00000000-0000-0000-0000-000000000000',
        true,
      );
    }

    nk.storageWrite([
      {
        collection: 'match_history',
        key: matchId,
        userId: '00000000-0000-0000-0000-000000000000',
        value: {
          matchId,
          gameId,
          gameName: gameConfig.name,
          time: Date.now(),
          players: participants,
        },
        permissionRead: 2,
        permissionWrite: 0,
      },
    ]);

    return JSON.stringify({ success: true, matchId });
  } catch (error) {
    return handleError(logger, 'matchresult', error);
  }
};
