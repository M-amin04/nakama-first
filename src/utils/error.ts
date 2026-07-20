export enum NakamaErrorCode {
  OK = 0,
  CANCELLED = 1,
  UNKNOWN = 2,
  INVALID_ARGUMENT = 3,
  DEADLINE_EXCEEDED = 4,
  NOT_FOUND = 5,
  ALREADY_EXISTS = 6,
  PERMISSION_DENIED = 7,
  RESOURCE_EXHAUSTED = 8,
  FAILED_PRECONDITION = 9,
  ABORTED = 10,
  OUT_OF_RANGE = 11,
  UNIMPLEMENTED = 12,
  INTERNAL = 13,
  UNAVAILABLE = 14,
  DATA_LOSS = 15,
  UNAUTHENTICATED = 16,
}

export enum ErrorMessage {
  PAYLOAD_EMPTY = 'Payload is empty.',
  UNAUTHORIZED = 'Unauthorized.',
  ADMIN_ONLY = 'Only admin can manage games.',
  INVALID_ARGUMENT = 'Invalid argument.',
  USER_NOT_FOUND = 'User does not exist or incorrect credentials.',
  INCORRECT_PASSWORD = 'Incorrect password.',
  GAME_NOT_FOUND = 'Game is not found.',
  OTP_NOT_FOUND = 'OTP not found.',
  OTP_EXPIRED = 'OTP has expired.',
  INVALID_OTP = 'Invalid OTP.',
  INTERNAL_SERVER_ERROR = 'Internal server error.',
  PHONE_ALREADY_REGISTERED = 'This phone number is already registered to another account.',
}

export enum MatchResultType {
  WIN = 'win',
  LOSE = 'lose',
}

export function handleError(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  functionName: string,
  error: any,
): never {
  logger.error(`Error in ${functionName}: ${error?.message || error}`);

  if (error && typeof error.code === 'number') {
    throw error;
  }

  const isProduction = ctx.env.NODE_ENV === 'production';

  if (isProduction) {
    throw {
      message: ErrorMessage.INTERNAL_SERVER_ERROR,
      code: NakamaErrorCode.INTERNAL,
    } as unknown as nkruntime.Error;
  } else {
    throw {
      message: error?.message || String(error),
      code: NakamaErrorCode.INTERNAL,
    } as unknown as nkruntime.Error;
  }
}
