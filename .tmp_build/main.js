"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const task_js_1 = require("./task.js");
const auth_js_1 = require("./auth.js");
const games_js_1 = require("./games.js");
const leaderboard_js_1 = require("./leaderboard.js");
const match_result_js_1 = require("./match_result.js");
function InitModule(ctx, logger, nk, initializer) {
    globalThis.afterAuthenticateDevice = task_js_1.afterAuthenticateDevice;
    globalThis.onLeaderboardReset = leaderboard_js_1.onLeaderboardReset;
    (0, leaderboard_js_1.initLeaderboard)(ctx, logger, nk);
    initializer.registerAfterAuthenticateDevice(task_js_1.afterAuthenticateDevice);
    initializer.registerLeaderboardReset(leaderboard_js_1.onLeaderboardReset);
    initializer.registerRpc('request_otp', auth_js_1.requestOtp);
    initializer.registerRpc('verify_otp', auth_js_1.verifyOtp);
    initializer.registerRpc('loginWithPassword', auth_js_1.loginWithPassword);
    initializer.registerRpc('setGameConfig', games_js_1.setGameConfig);
    initializer.registerRpc('getGameConfig', games_js_1.getGameConfig);
    initializer.registerRpc('matchresult', match_result_js_1.matchresult);
    initializer.registerRpc('get_shop_items', task_js_1.getShopItemsRpc);
    initializer.registerRpc('get_inventory', task_js_1.getInventoryRpc);
    initializer.registerRpc('set_active_item', task_js_1.setActiveItemRpc);
    initializer.registerRpc('buy_item', task_js_1.buyItemRpc);
    logger.info('JavaScript logic loaded.');
}
!InitModule && InitModule.bind(null);
