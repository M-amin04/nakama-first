export const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000';

export const AUTH_CONFIG = {
  TOKEN_EXPIRY_SECONDS: 3600,
  OTP_EXPIRY_MS: 120000,
  INITIAL_COIN: 1000,
  INITIAL_XP: 50,
};

export const STORAGE_COLLECTIONS = {
  USER_CREDENTIALS: 'user_credentials',
  PHONE_VERIFICATION: 'phone_verification',
  GAMES: 'games',
  PROCESSED_GAMES: 'processed_games',
  MATCH_HISTORY: 'match_history',
};

export const LEADERBOARD_CONFIG = {
  ID: 'leaderboard',
  RESET_SCHEDULE: '0 0 * * 0',
  TOP_REWARDS: [300, 300, 300],
};
