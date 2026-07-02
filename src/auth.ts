import * as v from 'valibot';
import { handleError } from './utils.js';

const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000';

export const requestOtp: nkruntime.RpcFunction = function (ctx, logger, nk, payload) {
  if (!payload) throw new Error('Payload is empty');

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

    logger.info(`OTP for phone ${data.phone}: ${otp}`);
    return JSON.stringify({ success: true });
  } catch (error: any) {
    return handleError(logger, 'requestOtp', error);
  }
};

export const verifyOtp: nkruntime.RpcFunction = function (ctx, logger, nk, payload) {
  if (!payload) throw new Error('Payload is empty');

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

    if (records.length === 0) throw new Error('OTP not found or expired');

    const storedData = records[0].value;

    if (Date.now() - storedData.createdAt > 120000) throw new Error('OTP has expired');

    if (storedData.otp !== data.otp) throw new Error('Invalid OTP');

    nk.storageDelete([
      {
        collection: 'phone_verification',
        key: data.phone,
        userId: SYSTEM_USER_ID,
      },
    ]);

    const authResult = nk.authenticateCustom(data.phone, data.phone, true);

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
    return handleError(logger, 'verifyOtp', error);
  }
};

export const loginWithPassword: nkruntime.RpcFunction = function (ctx, logger, nk, payload) {
  if (!payload) throw new Error('Payload is empty');

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
      throw new Error('User does not exist or incorrect credentials');
    }

    const credentials = nk.storageRead([
      {
        collection: 'user_credentials',
        key: authResult.userId,
        userId: SYSTEM_USER_ID,
      },
    ]);

    if (credentials.length === 0) {
      throw new Error('Incorrect credentials');
    }

    const storedPassword = credentials[0].value.password;

    if (storedPassword !== data.password) {
      throw new Error('Incorrect password');
    }

    const token = nk.authenticateTokenGenerate(
      authResult.userId,
      authResult.username,
      Math.floor(Date.now() / 1000) + 3600,
    );

    return JSON.stringify({ success: true, userId: authResult.userId, token: token });
  } catch (error) {
    return handleError(logger, 'loginWithPassword', error);
  }
};
