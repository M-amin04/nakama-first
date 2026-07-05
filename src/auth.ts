import * as v from 'valibot';

const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000';

export const requestOtp: nkruntime.RpcFunction = function (ctx, logger, nk, payload) {
  if (!payload) {
    throw { message: 'Payload is empty.', code: 3 } as nkruntime.Error;
  }

  try {
    const RequestOtpSchema = v.object({
      phone: v.string(),
      password: v.string(),
    });

    const data = v.parse(RequestOtpSchema, JSON.parse(payload));
    const otp = Math.floor(1000 + Math.random() * 9000).toString();

    nk.storageWrite([
      {
        collection: 'phone_verification',
        key: data.phone,
        userId: SYSTEM_USER_ID,
        value: { otp: otp, password: data.password, createdAt: Date.now() },
        permissionRead: 0,
        permissionWrite: 0,
      },
    ]);

    return JSON.stringify({ success: true });
  } catch (error: any) {
    logger.error(`Error in requestOtp: ${error?.message || error}`);

    if (error && typeof error.code === 'number') throw error;

    throw { message: error?.message || String(error), code: 3 } as nkruntime.Error;
  }
};

export const verifyOtp: nkruntime.RpcFunction = function (ctx, logger, nk, payload) {
  if (!payload) {
    throw { message: 'Payload is empty.', code: 3 } as nkruntime.Error;
  }

  try {
    const VerifyOtpSchema = v.object({
      phone: v.string(),
      otp: v.string(),
    });

    const data = v.parse(VerifyOtpSchema, JSON.parse(payload));

    const records = nk.storageRead([
      {
        collection: 'phone_verification',
        key: data.phone,
        userId: SYSTEM_USER_ID,
      },
    ]);

    if (records.length === 0) {
      throw {
        message: 'OTP not found.',
        code: 5,
      } as nkruntime.Error;
    }

    const storedData = records[0].value;

    if (Date.now() - storedData.createdAt > 120000) {
      throw {
        message: 'OTP has expired',
        code: 3,
      } as nkruntime.Error;
    }

    if (storedData.otp !== data.otp) {
      throw {
        message: 'Invalid OTP',
        code: 3,
      } as nkruntime.Error;
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
      const initialCoins = 1000;
      const initialXp = 50;

      const changeset = {
        coin: initialCoins,
        xp: initialXp,
      };

      const metadata = {
        reason: 'Initial registration bonus.',
      };

      nk.walletUpdate(authResult.userId, changeset, metadata, true);
    }

    nk.storageWrite([
      {
        collection: 'user_credentials',
        key: authResult.userId,
        userId: SYSTEM_USER_ID,
        value: { password: storedData.password },
        permissionRead: 0,
        permissionWrite: 0,
      },
    ]);

    const token = nk.authenticateTokenGenerate(
      authResult.userId,
      authResult.username,
      Math.floor(Date.now() / 1000) + 3600,
    );

    return JSON.stringify({
      success: true,
      userId: authResult.userId,
      token: token,
    });
  } catch (error: any) {
    logger.error(`Error in verifyOtp: ${error?.message || error}`);

    if (error && typeof error.code === 'number') throw error;

    throw { message: error?.message || String(error), code: 3 } as nkruntime.Error;
  }
};

export const loginWithPassword: nkruntime.RpcFunction = function (ctx, logger, nk, payload) {
  if (!payload) {
    throw { message: 'Payload is empty', code: 3 } as nkruntime.Error;
  }

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
        message: 'User does not exist or incorrect credentials',
        code: 16,
      } as nkruntime.Error; // UNAUTHENTICATED
    }

    const credentials = nk.storageRead([
      {
        collection: 'user_credentials',
        key: authResult.userId,
        userId: SYSTEM_USER_ID,
      },
    ]);

    if (credentials.length === 0) {
      throw { message: 'Incorrect credentials', code: 16 } as nkruntime.Error;
    }

    const storedPassword = credentials[0].value.password;

    if (storedPassword !== data.password) {
      throw { message: 'Incorrect password', code: 16 } as nkruntime.Error;
    }

    const token = nk.authenticateTokenGenerate(
      authResult.userId,
      authResult.username,
      Math.floor(Date.now() / 1000) + 3600,
    );

    return JSON.stringify({ success: true, userId: authResult.userId, token: token });
  } catch (error: any) {
    logger.error(`Error in loginWithPassword: ${error?.message || error}`);

    if (error && typeof error.code === 'number') throw error;

    throw { message: error?.message || String(error), code: 3 } as nkruntime.Error;
  }
};
