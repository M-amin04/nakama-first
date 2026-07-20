import * as v from 'valibot';
import { NakamaErrorCode, ErrorMessage, handleError } from './utils/error.js';
import { checkUser, checkPayload } from './utils/validator.js';
import { SYSTEM_USER_ID, AUTH_CONFIG, STORAGE_COLLECTIONS } from './utils/constants.js';

function generateUserToken(nk: nkruntime.Nakama, userId: string, username: string) {
  return nk.authenticateTokenGenerate(
    userId,
    username,
    Math.floor(Date.now() / 1000) + AUTH_CONFIG.TOKEN_EXPIRY_SECONDS,
  );
}

export const requestOtp: nkruntime.RpcFunction = function (ctx, logger, nk, payload) {
  checkPayload(payload);

  try {
    const RequestOtpSchema = v.object({
      phone: v.string(),
      password: v.string(),
    });

    const data = v.parse(RequestOtpSchema, JSON.parse(payload));
    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    const hashedPassword = nk.bcryptHash(data.password);

    nk.storageWrite([
      {
        collection: STORAGE_COLLECTIONS.PHONE_VERIFICATION,
        key: data.phone,
        userId: SYSTEM_USER_ID,
        value: {
          otp: otp,
          password: hashedPassword,
        },
        permissionRead: 0,
        permissionWrite: 0,
      },
    ]);

    return JSON.stringify({ success: true });
  } catch (error: any) {
    return handleError(ctx, logger, 'requestOtp', error);
  }
};

export const verifyOtp: nkruntime.RpcFunction = function (ctx, logger, nk, payload) {
  checkPayload(payload);

  try {
    const VerifyOtpSchema = v.object({
      phone: v.string(),
      otp: v.string(),
    });

    const data = v.parse(VerifyOtpSchema, JSON.parse(payload));

    const records = nk.storageRead([
      {
        collection: STORAGE_COLLECTIONS.PHONE_VERIFICATION,
        key: data.phone,
        userId: SYSTEM_USER_ID,
      },
    ]);

    if (records.length === 0) {
      throw {
        message: ErrorMessage.OTP_NOT_FOUND,
        code: NakamaErrorCode.NOT_FOUND,
      };
    }

    const storedData = records[0].value;

    if (Date.now() - storedData.createdAt > 120000) {
      throw {
        message: ErrorMessage.OTP_EXPIRED,
        code: NakamaErrorCode.INVALID_ARGUMENT,
      };
    }

    if (storedData.otp !== data.otp) {
      throw {
        message: ErrorMessage.INVALID_OTP,
        code: NakamaErrorCode.INVALID_ARGUMENT,
      };
    }

    nk.storageDelete([
      {
        collection: 'phone_verification',
        key: data.phone,
        userId: SYSTEM_USER_ID,
      },
    ]);

    const authResult = nk.authenticateCustom(data.phone, data.phone, true);

    if (authResult.created) {
      nk.walletUpdate(
        authResult.userId,
        { coin: AUTH_CONFIG.INITIAL_COIN, xp: AUTH_CONFIG.INITIAL_COIN },
        { reason: 'Initial registration bonus.' },
        true,
      );
    }

    nk.storageWrite([
      {
        collection: STORAGE_COLLECTIONS.USER_CREDENTIALS,
        key: authResult.userId,
        userId: SYSTEM_USER_ID,
        value: {
          phone: data.phone,
          password: storedData.password,
        },
        permissionRead: 0,
        permissionWrite: 0,
      },
    ]);

    return JSON.stringify({
      success: true,
      userId: authResult.userId,
      token: generateUserToken(nk, authResult.userId, authResult.username),
    });
  } catch (error: any) {
    return handleError(ctx, logger, 'verifyOtp', error);
  }
};

export const upgradeGuestAccount: nkruntime.RpcFunction = function (ctx, logger, nk, payload) {
  checkUser(ctx);
  checkPayload(payload);

  try {
    const upgradeSchema = v.object({
      phone: v.string(),
      password: v.string(),
    });

    const data = v.parse(upgradeSchema, JSON.parse(payload));

    let phoneExist = false;

    try {
      const testAuth = nk.authenticateCustom(data.phone, data.phone, false);

      if (testAuth.userId !== ctx.userId) phoneExist = true;
    } catch (e) {
      phoneExist = false;
    }

    if (phoneExist) {
      throw {
        message: ErrorMessage.PHONE_ALREADY_REGISTERED,
        code: NakamaErrorCode.ALREADY_EXISTS,
      };
    }

    nk.accountUpdateId(ctx.userId!, data.phone, ' ', null, null, null, null);

    const hashedPassword = nk.bcryptHash(data.password);

    nk.storageWrite([
      {
        collection: STORAGE_COLLECTIONS.USER_CREDENTIALS,
        key: ctx.userId!,
        userId: SYSTEM_USER_ID,
        value: {
          phone: data.phone,
          password: hashedPassword,
        },
        permissionRead: 0,
        permissionWrite: 0,
      },
    ]);

    return JSON.stringify({
      success: true,
      message: 'Account upgraded.',
      token: generateUserToken(nk, ctx.userId!, data.phone),
    });
  } catch (error: any) {
    return handleError(ctx, logger, 'upgradeGuestAccount', error);
  }
};

export const loginWithPassword: nkruntime.RpcFunction = function (ctx, logger, nk, payload) {
  checkPayload(payload);

  try {
    const LoginSchema = v.object({
      phone: v.string(),
      password: v.string(),
    });

    const data = v.parse(LoginSchema, JSON.parse(payload));

    let authResult;

    try {
      authResult = nk.authenticateCustom(data.phone, data.phone, false);
    } catch (error) {
      throw {
        message: ErrorMessage.USER_NOT_FOUND,
        code: NakamaErrorCode.UNAUTHENTICATED,
      };
    }

    const credentials = nk.storageRead([
      {
        collection: STORAGE_COLLECTIONS.USER_CREDENTIALS,
        key: authResult.userId,
        userId: SYSTEM_USER_ID,
      },
    ]);

    if (credentials.length === 0) {
      throw {
        message: ErrorMessage.USER_NOT_FOUND,
        code: NakamaErrorCode.UNAUTHENTICATED,
      };
    }

    const storedPassword = credentials[0].value.password;

    const isPasswordValid = nk.bcryptCompare(storedPassword, data.password);

    if (!isPasswordValid) {
      throw {
        message: ErrorMessage.INCORRECT_PASSWORD,
        code: NakamaErrorCode.UNAUTHENTICATED,
      };
    }

    return JSON.stringify({
      success: true,
      userId: authResult.userId,
      token: generateUserToken(nk, authResult.userId, authResult.username),
    });
  } catch (error: any) {
    return handleError(ctx, logger, 'loginWithPassword', error);
  }
};
