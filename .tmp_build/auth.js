"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.loginWithPassword = exports.verifyOtp = exports.requestOtp = void 0;
const v = __importStar(require("valibot"));
const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000';
const requestOtp = function (ctx, logger, nk, payload) {
    if (!payload) {
        throw { message: 'Payload is empty.', code: 3 };
    }
    try {
        const RequestOtpSchema = v.object({
            phone: v.string(),
            password: v.string(),
        });
        const data = v.parse(RequestOtpSchema, JSON.parse(payload));
        const otp = Math.floor(1000 + Math.random() * 9000).toString();
        const hashPendingPassword = nk.bcryptHash(data.password);
        nk.storageWrite([
            {
                collection: 'phone_verification',
                key: data.phone,
                userId: SYSTEM_USER_ID,
                value: {
                    otp: otp,
                    password: hashPendingPassword,
                    createdAt: Date.now()
                },
                permissionRead: 0,
                permissionWrite: 0,
            },
        ]);
        return JSON.stringify({ success: true });
    }
    catch (error) {
        logger.error(`Error in requestOtp: ${(error === null || error === void 0 ? void 0 : error.message) || error}`);
        if (error && typeof error.code === 'number')
            throw error;
        throw { message: (error === null || error === void 0 ? void 0 : error.message) || String(error), code: 3 };
    }
};
exports.requestOtp = requestOtp;
const verifyOtp = function (ctx, logger, nk, payload) {
    if (!payload) {
        throw { message: 'Payload is empty.', code: 3 };
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
            };
        }
        const storedData = records[0].value;
        if (Date.now() - storedData.createdAt > 120000) {
            throw {
                message: 'OTP has expired',
                code: 3,
            };
        }
        if (storedData.otp !== data.otp) {
            throw {
                message: 'Invalid OTP',
                code: 3,
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
        const token = nk.authenticateTokenGenerate(authResult.userId, authResult.username, Math.floor(Date.now() / 1000) + 3600);
        return JSON.stringify({
            success: true,
            userId: authResult.userId,
            token: token,
        });
    }
    catch (error) {
        logger.error(`Error in verifyOtp: ${(error === null || error === void 0 ? void 0 : error.message) || error}`);
        if (error && typeof error.code === 'number')
            throw error;
        throw { message: (error === null || error === void 0 ? void 0 : error.message) || String(error), code: 3 };
    }
};
exports.verifyOtp = verifyOtp;
const loginWithPassword = function (ctx, logger, nk, payload) {
    if (!payload) {
        throw { message: 'Payload is empty', code: 3 };
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
        }
        catch (error) {
            throw {
                message: 'User does not exist or incorrect credentials',
                code: 16,
            };
        }
        const credentials = nk.storageRead([
            {
                collection: 'user_credentials',
                key: authResult.userId,
                userId: SYSTEM_USER_ID,
            },
        ]);
        if (credentials.length === 0) {
            throw { message: 'Incorrect credentials', code: 16 };
        }
        const storedPassword = credentials[0].value.password;
        const isPasswordValid = nk.bcryptCompare(data.password, storedPassword);
        if (!isPasswordValid) {
            throw { message: 'Incorrect password', code: 16 };
        }
        const token = nk.authenticateTokenGenerate(authResult.userId, authResult.username, Math.floor(Date.now() / 1000) + 3600);
        return JSON.stringify({ success: true, userId: authResult.userId, token: token });
    }
    catch (error) {
        logger.error(`Error in loginWithPassword: ${(error === null || error === void 0 ? void 0 : error.message) || error}`);
        if (error && typeof error.code === 'number')
            throw error;
        throw { message: (error === null || error === void 0 ? void 0 : error.message) || String(error), code: 3 };
    }
};
exports.loginWithPassword = loginWithPassword;
