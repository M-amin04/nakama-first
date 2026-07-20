import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setGameConfig, getGameConfig } from '../games.js';
import { ErrorMessage, NakamaErrorCode } from '../utils/error.js';

describe('Game RPC Tests', () => {
  // Create simplified mock Nakama inputs
  let mockCtx: nkruntime.Context;
  let mockLogger: nkruntime.Logger;
  let mockNk: nkruntime.Nakama;

  beforeEach(() => {
    mockCtx = { userId: 'user-admin-123' } as nkruntime.Context;
    mockLogger = { error: vi.fn(), info: vi.fn() } as unknown as nkruntime.Logger;

    // Mock only the methods used in the file
    mockNk = {
      accountGetId: vi.fn(),
      storageWrite: vi.fn(),
      storageRead: vi.fn(),
    } as unknown as nkruntime.Nakama;
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
      // 1. Initial condition: user has admin role
      vi.spyOn(mockNk, 'accountGetId').mockReturnValue({
        user: {
          userId: 'user-admin-123',
          username: 'admin',
          displayName: 'Admin User',
          avatarUrl: '',
          langTag: 'en',
          location: '',
          timezone: '',
          metadata: { role: 'admin' },
          edgeCount: 0,
          createTime: 0,
          updateTime: 0,
          online: false,
          appleId: '',
          facebookId: '',
          facebookInstantGameId: '',
          googleId: '',
          gamecenterId: '',
          steamId: '',
        },
        wallet: {},
        email: '',
        devices: [],
        customId: '',
        verifyTime: 0,
        disableTime: 0,
      } as nkruntime.Account);

      // 2. Execute function
      const result = setGameConfig(mockCtx, mockLogger, mockNk, validPayload);

      // 3. Verify result
      expect(JSON.parse(result as string)).toEqual({ success: true });
      expect(mockNk.storageWrite).toHaveBeenCalledTimes(1);
    });

    it('should throw error if user is not admin', () => {
      // 1. Initial condition: user is not admin
      vi.spyOn(mockNk, 'accountGetId').mockReturnValue({
        user: {
          userId: 'user-player-456',
          username: 'player',
          displayName: 'Player User',
          avatarUrl: '',
          langTag: 'en',
          location: '',
          timezone: '',
          metadata: { role: 'player' },
          edgeCount: 0,
          createTime: 0,
          updateTime: 0,
          online: false,
          appleId: '',
          facebookId: '',
          facebookInstantGameId: '',
          googleId: '',
          gamecenterId: '',
          steamId: '',
        },
        wallet: {},
        email: '',
        devices: [],
        customId: '',
        verifyTime: 0,
        disableTime: 0,
      } as nkruntime.Account);

      // 2 and 3. Execute function and expect error
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

      // Simulate finding game in storage
      vi.spyOn(mockNk, 'storageRead').mockReturnValue([
        {
          key: 'game_1',
          collection: 'games',
          userId: '',
          version: '',
          permissionRead: 0,
          permissionWrite: 0,
          createTime: 0,
          updateTime: 0,
          value: gameData,
        } as nkruntime.StorageObject,
      ]);

      const result = JSON.parse(getGameConfig(mockCtx, mockLogger, mockNk, payload) as string);

      expect(result.success).toBe(true);
      expect(result.game).toEqual(gameData);
    });

    it('should throw NOT_FOUND error if game is not found', () => {
      // Simulate empty storage
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
