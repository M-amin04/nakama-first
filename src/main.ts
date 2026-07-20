// Copyright 2020 The Nakama Authors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import {
  afterAuthenticateDevice,
  buyItemRpc,
  getInventoryRpc,
  getShopItemsRpc,
  setActiveItemRpc,
} from './task.js';
import { requestOtp, verifyOtp, upgradeGuestAccount, loginWithPassword } from './auth.js';
import { setGameConfig, getGameConfig } from './games.js';
import { initLeaderboard, onLeaderboardReset } from './leaderboard.js';
import { matchresult } from './match_result.js';

// import { rpcReward } from "./daily_rewards.js";
// import { moduleName, matchInit, matchJoinAttempt, matchJoin, matchLeave, matchLoop, matchTerminate, matchSignal } from "./match_handler.js";
// import { rpcFindMatch } from "./match_rpc.js";

// const rpcIdRewards = 'rewards_js';
// const rpcIdFindMatch = 'find_match_js';

function InitModule(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  initializer: nkruntime.Initializer,
) {
  (globalThis as any).afterAuthenticateDevice = afterAuthenticateDevice;
  (globalThis as any).onLeaderboardReset = onLeaderboardReset;
  initLeaderboard(ctx, logger, nk);

  initializer.registerAfterAuthenticateDevice(afterAuthenticateDevice);

  initializer.registerLeaderboardReset(onLeaderboardReset);

  initializer.registerRpc('request_otp', requestOtp);
  initializer.registerRpc('verify_otp', verifyOtp);
  initializer.registerRpc('upgrade_guest_account', upgradeGuestAccount);
  initializer.registerRpc('loginWithPassword', loginWithPassword);

  initializer.registerRpc('setGameConfig', setGameConfig);
  initializer.registerRpc('getGameConfig', getGameConfig);
  initializer.registerRpc('matchresult', matchresult);

  initializer.registerRpc('get_shop_items', getShopItemsRpc);
  initializer.registerRpc('get_inventory', getInventoryRpc);
  initializer.registerRpc('set_active_item', setActiveItemRpc);
  initializer.registerRpc('buy_item', buyItemRpc);

  logger.info('JavaScript logic loaded.');
}

!InitModule && InitModule.bind(null);
