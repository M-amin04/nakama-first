import { describe, it, expect, vi, beforeEach } from 'vitest';
import { initLeaderboard, onLeaderboardReset } from '../leaderboard.js';
import { LEADERBOARD_CONFIG } from '../utils/constants.js';

describe('Leaderboard Module Tests', () => {
  let mockCtx: nkruntime.Context;
  let mockLogger: nkruntime.Logger;
  let mockNk: nkruntime.Nakama;

  beforeEach(() => {
    mockCtx = {} as nkruntime.Context;
    mockLogger = { error: vi.fn(), info: vi.fn() } as unknown as nkruntime.Logger;


    const leaderboardCreateMock = vi.fn();
    const leaderboardRecordsListMock = vi.fn();
    const walletUpdateMock = vi.fn();

    mockNk = {
      leaderboardCreate: leaderboardCreateMock,
      leaderboardRecordsList: leaderboardRecordsListMock,
      walletUpdate: walletUpdateMock,
    } as unknown as nkruntime.Nakama;
  });

  // --------------------------------------------------
  // 1. Test leaderboard creation (initLeaderboard)
  // --------------------------------------------------
  describe('initLeaderboard', () => {
    it('should create leaderboard with correct parameters', () => {
      (global as any).nkruntime = {
        SortOrder: { DESCENDING: 1 },
        Operator: { SET: 0 },
      };

      initLeaderboard(mockCtx, mockLogger, mockNk);

      expect(mockNk.leaderboardCreate).toHaveBeenCalledTimes(1);
      expect(mockNk.leaderboardCreate).toHaveBeenCalledWith(
        LEADERBOARD_CONFIG.ID,
        true,
        1, 
        0, 
        LEADERBOARD_CONFIG.RESET_SCHEDULE,
        {},
      );
    });

    it('should log error and not crash if error occurs', () => {
      vi.spyOn(mockNk, 'leaderboardCreate').mockImplementation(() => {
        throw new Error('Database Error');
      });

      expect(() => initLeaderboard(mockCtx, mockLogger, mockNk)).not.toThrow();
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  // --------------------------------------------------
  // 2. Test reward distribution (onLeaderboardReset)
  // --------------------------------------------------
  describe('onLeaderboardReset', () => {
    const mockLeaderboard = { id: LEADERBOARD_CONFIG.ID } as nkruntime.Leaderboard;
    const expiryTime = 1700000000;

    it('should reward top 3 players in leaderboard', () => {
      vi.spyOn(mockNk, 'leaderboardRecordsList').mockReturnValue({
        records: [{ ownerId: 'user-1' }, { ownerId: 'user-2' }, { ownerId: 'user-3' }],
      } as nkruntime.LeaderboardRecordList);

      onLeaderboardReset(mockCtx, mockLogger, mockNk, mockLeaderboard, expiryTime);

      expect(mockNk.leaderboardRecordsList).toHaveBeenCalledWith(
        LEADERBOARD_CONFIG.ID,
        undefined,
        3,
        undefined,
        expiryTime,
      );

      expect(mockNk.walletUpdate).toHaveBeenCalledTimes(3);

      expect(mockNk.walletUpdate).toHaveBeenNthCalledWith(
        1,
        'user-1',
        { coin: LEADERBOARD_CONFIG.TOP_REWARDS[0] },
        { reason: 'Weekly leaderboard rank 1 reward.' },
        true,
      );
    });

    it('should do nothing if leaderboard ID is different', () => {
      const otherLeaderboard = { id: 'other_id' } as nkruntime.Leaderboard;

      onLeaderboardReset(mockCtx, mockLogger, mockNk, otherLeaderboard, expiryTime);

      expect(mockNk.leaderboardRecordsList).not.toHaveBeenCalled();
      expect(mockNk.walletUpdate).not.toHaveBeenCalled();
    });
  });
});
