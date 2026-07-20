import { describe, it, expect, vi, beforeEach } from 'vitest';
import { matchresult } from '../match_result.js';
import { ErrorMessage, NakamaErrorCode, MatchResultType } from '../utils/error.js';
import { LEADERBOARD_CONFIG } from '../utils/constants.js';

describe('Match Result RPC Tests', () => {
  let mockCtx: any;
  let mockLogger: any;
  let mockNk: any;

  beforeEach(() => {
    mockCtx = {};
    mockLogger = { error: vi.fn(), info: vi.fn() };

    mockNk = {
      storageRead: vi.fn(),
      storageWrite: vi.fn(),
      uuidv4: vi.fn().mockReturnValue('mocked-uuid-1234'),
      walletUpdate: vi.fn(),
      leaderboardRecordWrite: vi.fn(),
      notificationsSend: vi.fn(),
    };
  });

  // --------------------------------------------------
  // 1. Test already processed games
  // --------------------------------------------------
  it('should return alreadyProcessed=true if game was already processed', () => {
    const payload = JSON.stringify({
      gameId: 'game_001',
      participants: [{ userId: 'user_1', result: MatchResultType.WIN, score: 100 }],
    });

    vi.spyOn(mockNk, 'storageRead').mockReturnValueOnce([
      { value: { matchId: 'existing-match-id' } },
    ]);

    const result = JSON.parse(matchresult(mockCtx, mockLogger, mockNk, payload) as string);

    expect(result).toEqual({
      success: true,
      matchId: 'existing-match-id',
      alreadyProcessed: true,
    });
    expect(mockNk.walletUpdate).not.toHaveBeenCalled();
    expect(mockNk.storageWrite).not.toHaveBeenCalled();
  });

  // --------------------------------------------------
  // 2. Test game not found
  // --------------------------------------------------
  it('should throw GAME_NOT_FOUND error if game config is not found', () => {
    const payload = JSON.stringify({
      gameId: 'unknown_game',
      participants: [{ userId: 'user_1', result: MatchResultType.WIN, score: 100 }],
    });

    vi.spyOn(mockNk, 'storageRead')
      .mockReturnValueOnce([]) 
      .mockReturnValueOnce([]); 

    expect(() => matchresult(mockCtx, mockLogger, mockNk, payload)).toThrow(
      expect.objectContaining({
        message: ErrorMessage.GAME_NOT_FOUND,
        code: NakamaErrorCode.NOT_FOUND,
      }),
    );
  });

  // --------------------------------------------------
  // 3. Test complete and successful game processing
  // --------------------------------------------------
  it('should update wallet, record leaderboard, and send notifications', () => {
    const payload = JSON.stringify({
      gameId: 'game_001',
      participants: [
        { userId: 'player_win', result: MatchResultType.WIN, score: 250 },
        { userId: 'player_lose', result: MatchResultType.LOSE, score: 50 },
      ],
    });

    const mockGameConfig = {
      gameName: 'Backgammon',
      entryFee: 100,
      winnerReward: 180,
      loserReward: 10,
      xp: 20,
    };

    vi.spyOn(mockNk, 'storageRead')
      .mockReturnValueOnce([])
      .mockReturnValueOnce([{ value: mockGameConfig }]);

    const result = JSON.parse(matchresult(mockCtx, mockLogger, mockNk, payload) as string);

    expect(result).toEqual({
      success: true,
      matchId: 'mocked-uuid-1234',
    });

    expect(mockNk.walletUpdate).toHaveBeenNthCalledWith(
      1,
      'player_win',
      { coin: 80, xp: 20 },
      { matchId: 'mocked-uuid-1234', gameName: 'Backgammon' },
      true,
    );

    expect(mockNk.walletUpdate).toHaveBeenNthCalledWith(
      2,
      'player_lose',
      { coin: -90, xp: 20 },
      { matchId: 'mocked-uuid-1234', gameName: 'Backgammon' },
      true,
    );

    expect(mockNk.leaderboardRecordWrite).toHaveBeenCalledTimes(1);
    expect(mockNk.leaderboardRecordWrite).toHaveBeenCalledWith(
      LEADERBOARD_CONFIG.ID,
      'player_win',
      'player_win',
      250,
    );

    expect(mockNk.notificationsSend).toHaveBeenCalledTimes(1);

    expect(mockNk.storageWrite).toHaveBeenCalledTimes(2);
  });
});