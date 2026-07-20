import { NakamaErrorCode, ErrorMessage } from './error.js';

export function checkUser(ctx: nkruntime.Context) {
  if (!ctx.userId) {
    throw {
      message: ErrorMessage.UNAUTHORIZED,
      code: NakamaErrorCode.UNAUTHENTICATED,
    };
  }
}

export function checkPayload(payload: string | null) {
  if (!payload || payload.trim() === '' || payload === '{}') {
    throw {
      message: ErrorMessage.PAYLOAD_EMPTY,
      code: NakamaErrorCode.INVALID_ARGUMENT,
    };
  }
}
