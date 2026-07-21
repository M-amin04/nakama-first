import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setGameConfig, getGameConfig } from '../games.js';
import { ErrorMessage, NakamaErrorCode } from '../utils/error.js';

describe('Game RPC Tests', () => {
  let mockCtx: any;
  let mockLogger: any;
  let mockNk: any;

  beforeEach(() => {
    mockCtx = { userId: 'user-admin-123' };
    mockLogger = { error: vi.fn(), info: vi.fn() };

    mockNk = {
      accountGetId: vi.fn(),
      storageWrite: vi.fn(),
      storageRead: vi.fn(),
    };
  });

  // --------------------------------------------------
  // 1. Test setGameConfig function
  // --------------------------------------------------
  describe('setGameConfig', () => {
    const validPayload = JSON.stringify({
      gameId: 'game_1',
      gameName: 'Ludo',
      entryFee: 100,
      winnerReward: 150,
      loserReward: 0,
      maxPlayers: 4,
      xp: 10,
    });

    it('should save game config if user is admin', () => {
      mockNk.accountGetId.mockReturnValue({
        user: { metadata: { role: 'admin' } },
      });

      const result = setGameConfig(mockCtx, mockLogger, mockNk, validPayload);

      expect(JSON.parse(result as string)).toEqual({ success: true });
      expect(mockNk.storageWrite).toHaveBeenCalledTimes(1);
    });

    it('should throw error if user is not admin', () => {
      mockNk.accountGetId.mockReturnValue({
        user: { metadata: { role: 'player' } },
      });

      expect(() => setGameConfig(mockCtx, mockLogger, mockNk, validPayload)).toThrow(
        expect.objectContaining({
          message: ErrorMessage.ADMIN_ONLY,
          code: NakamaErrorCode.PERMISSION_DENIED,
        }),
      );
    });
  });

  // --------------------------------------------------
  // 2. Test getGameConfig function
  // --------------------------------------------------
  describe('getGameConfig', () => {
    const payload = JSON.stringify({ gameId: 'game_1' });

    it('should return game information if game exists', () => {
      const gameData = { gameName: 'Ludo', entryFee: 100 };

      mockNk.storageRead.mockReturnValue([
        { value: gameData },
      ]);

      const result = JSON.parse(getGameConfig(mockCtx, mockLogger, mockNk, payload) as string);

      expect(result.success).toBe(true);
      expect(result.game).toEqual(gameData);
    });

    it('should throw NOT_FOUND error if game is not found', () => {
      vi.spyOn(mockNk, 'storageRead').mockReturnValue([]);

      expect(() => getGameConfig(mockCtx, mockLogger, mockNk, payload)).toThrow(
        expect.objectContaining({
          message: ErrorMessage.GAME_NOT_FOUND,
          code: NakamaErrorCode.NOT_FOUND,
        }),
      );
    });
  });
});