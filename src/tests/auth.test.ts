import { describe, it, expect, vi, beforeEach } from 'vitest';
import { requestOtp, verifyOtp, loginWithPassword } from '../auth.js';
import { ErrorMessage, NakamaErrorCode } from '../utils/error.js';
import { STORAGE_COLLECTIONS, SYSTEM_USER_ID, AUTH_CONFIG } from '../utils/constants.js';

describe('Auth RPC Functions', () => {
  let mockCtx: any;
  let mockLogger: any;
  let mockNk: any;

  beforeEach(() => {
    mockCtx = { userId: 'user-123', env: { NODE_ENV: 'development' } };
    mockLogger = { info: vi.fn(), error: vi.fn() };
    mockNk = {
      bcryptHash: vi.fn().mockReturnValue('hashed_password'),
      bcryptCompare: vi.fn(),
      storageWrite: vi.fn(),
      storageRead: vi.fn(),
      storageDelete: vi.fn(),
      authenticateCustom: vi.fn(),
      authenticateTokenGenerate: vi.fn().mockReturnValue('mocked_token'),
      walletUpdate: vi.fn(),
      accountUpdateId: vi.fn(),
    };
  });

  // ------------------------------------------------------------------
  // 1. requestOtp Tests
  // ------------------------------------------------------------------
  describe('requestOtp', () => {
    it('should hash the password and save it in OTP storage', () => {
      const payload = JSON.stringify({ phone: '09123456789', password: 'pass123' });

      const result = requestOtp(mockCtx, mockLogger, mockNk, payload);

      expect(mockNk.bcryptHash).toHaveBeenCalledWith('pass123');
      expect(mockNk.storageWrite).toHaveBeenCalledWith([
        expect.objectContaining({
          collection: STORAGE_COLLECTIONS.PHONE_VERIFICATION,
          key: '09123456789',
          userId: SYSTEM_USER_ID,
        }),
      ]);
      expect(JSON.parse(result as string)).toEqual({ success: true });
    });
  });

  // ------------------------------------------------------------------
  // 2. verifyOtp Tests
  // ------------------------------------------------------------------
  describe('verifyOtp', () => {
    it('should charge user wallet and return token when OTP is correct', () => {
      const payload = JSON.stringify({ phone: '09123456789', otp: '1234' });

      mockNk.storageRead.mockReturnValue([
        {
          value: {
            otp: '1234',
            password: 'hashed_password',
            createdAt: Date.now(),
          },
        },
      ]);

      mockNk.authenticateCustom.mockReturnValue({
        userId: 'user-id-1',
        username: '09123456789',
        created: true,
      });

      const result = JSON.parse(verifyOtp(mockCtx, mockLogger, mockNk, payload) as string);

      expect(mockNk.walletUpdate).toHaveBeenCalledWith(
        'user-id-1',
        { coin: AUTH_CONFIG.INITIAL_COIN, xp: AUTH_CONFIG.INITIAL_COIN },
        expect.any(Object),
        true,
      );
      expect(result.success).toBe(true);
      expect(result.token).toBe('mocked_token');
    });

    it('should throw NOT_FOUND error if OTP is not found', () => {
      const payload = JSON.stringify({ phone: '09123456789', otp: '1234' });
      mockNk.storageRead.mockReturnValue([]);

      expect(() => verifyOtp(mockCtx, mockLogger, mockNk, payload)).toThrow(
        expect.objectContaining({
          message: ErrorMessage.OTP_NOT_FOUND,
          code: NakamaErrorCode.NOT_FOUND,
        }),
      );
    });
  });

  // ------------------------------------------------------------------
  // 3. loginWithPassword Tests
  // ------------------------------------------------------------------
  describe('loginWithPassword', () => {
    it('should throw INCORRECT_PASSWORD error if password is wrong', () => {
      const payload = JSON.stringify({ phone: '09123456789', password: 'wrong_password' });

      mockNk.authenticateCustom.mockReturnValue({ userId: 'user-123' });
      mockNk.storageRead.mockReturnValue([{ value: { password: 'hashed_password' } }]);
      mockNk.bcryptCompare.mockReturnValue(false);

      expect(() => loginWithPassword(mockCtx, mockLogger, mockNk, payload)).toThrow(
        expect.objectContaining({
          message: ErrorMessage.INCORRECT_PASSWORD,
          code: NakamaErrorCode.UNAUTHENTICATED,
        }),
      );
    });
  });
});
