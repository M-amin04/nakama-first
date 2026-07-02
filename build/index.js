function validateAndParse(ctx, payload) {
  const userId = ctx.userId;
  if (!userId) {
    throw new Error('User ID not found in context.');
  }
  if (!payload) {
    throw new Error('Payload is empty.');
  }
  try {
    const input = JSON.parse(payload);
    return {
      userId,
      input
    };
  } catch (error) {
    throw new Error('Invalid JSON payload.');
  }
}
const afterAuthenticateDevice = function (ctx, logger, nk, data, request) {
  if (!data.created) {
    logger.info(`User ${ctx.userId} already exists. Skipping initialization.`);
    return;
  }
  const userId = ctx.userId;
  if (!userId) {
    logger.error(`User ID is undefined in context.`);
    return;
  }
  const randomNumericUsername = Math.floor(10000000000 + Math.random() * 90000000000).toString();
  const randomNumricDisplayname = 'Guest_' + randomNumericUsername;
  const initialWallet = {
    coins: 1000,
    gems: 50
  };
  try {
    nk.accountUpdateId(userId, randomNumericUsername, randomNumricDisplayname, null, null, null, null);
    const metadata = {
      comment: 'Initial sign-up rewards'
    };
    nk.walletUpdate(userId, initialWallet, metadata, true);
  } catch (error) {
    logger.error(`Failed to initialize new user account: ${String(error)}`);
  }
};
const getShopItemsRpc = function (ctx, logger, nk, payload) {
  const userId = '00000000-0000-0000-0000-000000000000';
  try {
    const objectids = [{
      collection: 'configs',
      key: 'shop',
      userId: userId
    }];
    const record = nk.storageRead(objectids);
    if (record.length === 0) return JSON.stringify({
      items: []
    });
    const shopdata = record[0].value;
    return JSON.stringify(shopdata);
  } catch (error) {
    logger.error(`Failed to fetch shop: ${String(error)}`);
    throw new Error('Internal server error during fetching shop.');
  }
};
const getInventoryRpc = function (ctx, logger, nk, payload) {
  const userId = ctx.userId;
  if (!userId) {
    throw new Error('User ID not found in context.');
  }
  try {
    const objectIds = [{
      collection: 'inventory',
      key: 'items',
      userId: userId
    }];
    const records = nk.storageRead(objectIds);
    if (records.length === 0) {
      return JSON.stringify({
        items: []
      });
    }
    const inventoryData = records[0].value;
    return JSON.stringify(inventoryData);
  } catch (error) {
    logger.error(`Failed to fetch inventory: ${String(error)}`);
    throw new Error(`Internal server error during fetching inventory.`);
  }
};
const setActiveItemRpc = function (ctx, logger, nk, payload) {
  const {
    userId,
    input
  } = validateAndParse(ctx, payload);
  if (!input.itemType || !input.itemId) {
    throw new Error('Missing itemType or itemId in payload.');
  }
  try {
    const inventoryObjectIds = [{
      collection: "inventory",
      key: "items",
      userId: userId
    }];
    const records = nk.storageRead(inventoryObjectIds);
    let inventoryItems = [];
    if (records.length > 0) {
      const currentData = records[0].value;
      if (currentData && Array.isArray(currentData.items)) {
        inventoryItems = currentData.items;
      }
    }
    if (!inventoryItems.includes(input.itemId)) {
      throw new Error('You do not own this item. Purchase it first.');
    }
    const account = nk.accountGetId(userId);
    let metadata = {};
    if (account.user && account.user.metadata) metadata = account.user.metadata;
    if (!metadata.activeItems) metadata.activeItems = {};
    metadata.activeItems[input.itemType] = input.itemId;
    nk.accountUpdateId(userId, null, null, null, null, null, null, metadata);
    return JSON.stringify({
      success: true,
      activeItems: metadata.activeItems
    });
  } catch (error) {
    logger.error(`Failed to set active item: ${String(error)}`);
    throw new Error(`Internal server error during item equipment.`);
  }
};
const buyItemRpc = function (ctx, logger, nk, payload) {
  const {
    userId,
    input
  } = validateAndParse(ctx, payload);
  if (!input.itemId) {
    throw new Error('Missing itemId in payload.');
  }
  const systemUserId = '00000000-0000-0000-0000-000000000000';
  const shopObjectIds = [{
    collection: "configs",
    key: "shop",
    userId: systemUserId
  }];
  const shopRecords = nk.storageRead(shopObjectIds);
  if (shopRecords.length === 0) {
    throw new Error('Shop configuration not found on server.');
  }
  const shopData = shopRecords[0].value;
  if (!shopData || !shopData.items) {
    throw new Error('Invalid shop data structure.');
  }
  const itemDetails = shopData.items[input.itemId];
  if (!itemDetails) {
    throw new Error('Item not found in shop.');
  }
  const itemPrice = itemDetails.price;
  try {
    const inventoryObjectIds = [{
      collection: 'inventory',
      key: 'items',
      userId: userId
    }];
    const records = nk.storageRead(inventoryObjectIds);
    let inventoryItems = [];
    let version = null;
    if (records.length > 0) {
      version = records[0].version;
      const currentData = records[0].value;
      if (currentData && Array.isArray(currentData.items)) {
        inventoryItems = currentData.items;
      }
    }
    if (inventoryItems.includes(input.itemId)) {
      throw new Error('You already own this item.');
    }
    inventoryItems.push(input.itemId);
    const singlestorageWrite = {
      collection: 'inventory',
      key: 'items',
      userId: userId,
      value: {
        items: inventoryItems
      },
      permissionRead: 1,
      permissionWrite: 0
    };
    if (version) singlestorageWrite.version = version;
    const storageWrites = [singlestorageWrite];
    const walletUpdates = [{
      userId: userId,
      changeset: {
        coins: -itemPrice
      }
    }];
    const accountUpdates = [];
    const storageDeletes = [];
    const result = nk.multiUpdate(accountUpdates, storageWrites, storageDeletes, walletUpdates, true);
    logger.info(`buy is success! Storage Acks: ${result.storageWriteAcks.length}, Wallet Acks: ${result.walletUpdateAcks.length}`);
    return JSON.stringify({
      success: true,
      boughtItem: input.itemId,
      inventory: inventoryItems
    });
  } catch (error) {
    logger.error(`Shop purchase failed: ${error.message || String(error)}`);
    throw error;
  }
};

// src/storages/globalConfig/globalConfig.ts
var store;
// @__NO_SIDE_EFFECTS__
function getGlobalConfig(config2) {
  return {
    lang: config2?.lang ?? store?.lang,
    message: config2?.message,
    abortEarly: config2?.abortEarly ?? store?.abortEarly,
    abortPipeEarly: config2?.abortPipeEarly ?? store?.abortPipeEarly
  };
}

// src/storages/globalMessage/globalMessage.ts
var store2;
// @__NO_SIDE_EFFECTS__
function getGlobalMessage(lang) {
  return store2?.get(lang);
}

// src/storages/schemaMessage/schemaMessage.ts
var store3;
// @__NO_SIDE_EFFECTS__
function getSchemaMessage(lang) {
  return store3?.get(lang);
}

// src/storages/specificMessage/specificMessage.ts
var store4;
// @__NO_SIDE_EFFECTS__
function getSpecificMessage(reference, lang) {
  return store4?.get(reference)?.get(lang);
}

// src/utils/_stringify/_stringify.ts
// @__NO_SIDE_EFFECTS__
function _stringify(input) {
  const type = typeof input;
  if (type === "string") {
    return `"${input}"`;
  }
  if (type === "number" || type === "bigint" || type === "boolean") {
    return `${input}`;
  }
  if (type === "object" || type === "function") {
    return (input && Object.getPrototypeOf(input)?.constructor?.name) ?? "null";
  }
  return type;
}

// src/utils/_addIssue/_addIssue.ts
function _addIssue(context, label, dataset, config2, other) {
  const input = other && "input" in other ? other.input : dataset.value;
  const expected = other?.expected ?? context.expects ?? null;
  const received = other?.received ?? _stringify(input);
  const issue = {
    kind: context.kind,
    type: context.type,
    input,
    expected,
    received,
    message: `Invalid ${label}: ${expected ? `Expected ${expected} but r` : "R"}eceived ${received}`,
    requirement: context.requirement,
    path: other?.path,
    issues: other?.issues,
    lang: config2.lang,
    abortEarly: config2.abortEarly,
    abortPipeEarly: config2.abortPipeEarly
  };
  const isSchema = context.kind === "schema";
  const message = other?.message ?? context.message ?? getSpecificMessage(context.reference, issue.lang) ?? (isSchema ? getSchemaMessage(issue.lang) : null) ?? config2.message ?? getGlobalMessage(issue.lang);
  if (message !== void 0) {
    issue.message = typeof message === "function" ?
    // @ts-expect-error
    message(issue) : message;
  }
  if (isSchema) {
    dataset.typed = false;
  }
  if (dataset.issues) {
    dataset.issues.push(issue);
  } else {
    dataset.issues = [issue];
  }
}

// src/utils/_getStandardProps/_getStandardProps.ts
// @__NO_SIDE_EFFECTS__
function _getStandardProps(context) {
  return {
    version: 1,
    vendor: "valibot",
    validate(value2) {
      return context["~run"]({
        value: value2
      }, getGlobalConfig());
    }
  };
}

// src/utils/ValiError/ValiError.ts
var ValiError = class extends Error {
  /**
   * Creates a Valibot error with useful information.
   *
   * @param issues The error issues.
   */
  constructor(issues) {
    super(issues[0].message);
    this.name = "ValiError";
    this.issues = issues;
  }
};

// src/methods/getFallback/getFallback.ts
// @__NO_SIDE_EFFECTS__
function getFallback(schema, dataset, config2) {
  return typeof schema.fallback === "function" ?
  // @ts-expect-error
  schema.fallback(dataset, config2) :
  // @ts-expect-error
  schema.fallback;
}

// src/methods/getDefault/getDefault.ts
// @__NO_SIDE_EFFECTS__
function getDefault(schema, dataset, config2) {
  return typeof schema.default === "function" ?
  // @ts-expect-error
  schema.default(dataset, config2) :
  // @ts-expect-error
  schema.default;
}

// src/schemas/number/number.ts
// @__NO_SIDE_EFFECTS__
function number(message) {
  return {
    kind: "schema",
    type: "number",
    reference: number,
    expects: "number",
    async: false,
    message,
    get "~standard"() {
      return _getStandardProps(this);
    },
    "~run"(dataset, config2) {
      if (typeof dataset.value === "number" && !isNaN(dataset.value)) {
        dataset.typed = true;
      } else {
        _addIssue(this, "type", dataset, config2);
      }
      return dataset;
    }
  };
}

// src/schemas/object/object.ts
// @__NO_SIDE_EFFECTS__
function object(entries, message) {
  return {
    kind: "schema",
    type: "object",
    reference: object,
    expects: "Object",
    async: false,
    entries,
    message,
    get "~standard"() {
      return _getStandardProps(this);
    },
    "~run"(dataset, config2) {
      const input = dataset.value;
      if (input && typeof input === "object") {
        dataset.typed = true;
        dataset.value = {};
        for (const key in this.entries) {
          const valueSchema = this.entries[key];
          if (key in input || (valueSchema.type === "exact_optional" || valueSchema.type === "optional" || valueSchema.type === "nullish") &&
          // @ts-expect-error
          valueSchema.default !== void 0) {
            const value2 = key in input ?
            // @ts-expect-error
            input[key] : getDefault(valueSchema);
            const valueDataset = valueSchema["~run"]({
              value: value2
            }, config2);
            if (valueDataset.issues) {
              const pathItem = {
                type: "object",
                origin: "value",
                input,
                key,
                value: value2
              };
              for (const issue of valueDataset.issues) {
                if (issue.path) {
                  issue.path.unshift(pathItem);
                } else {
                  issue.path = [pathItem];
                }
                dataset.issues?.push(issue);
              }
              if (!dataset.issues) {
                dataset.issues = valueDataset.issues;
              }
              if (config2.abortEarly) {
                dataset.typed = false;
                break;
              }
            }
            if (!valueDataset.typed) {
              dataset.typed = false;
            }
            dataset.value[key] = valueDataset.value;
          } else if (valueSchema.fallback !== void 0) {
            dataset.value[key] = getFallback(valueSchema);
          } else if (valueSchema.type !== "exact_optional" && valueSchema.type !== "optional" && valueSchema.type !== "nullish") {
            _addIssue(this, "key", dataset, config2, {
              input: void 0,
              expected: `"${key}"`,
              path: [{
                type: "object",
                origin: "key",
                input,
                key,
                // @ts-expect-error
                value: input[key]
              }]
            });
            if (config2.abortEarly) {
              break;
            }
          }
        }
      } else {
        _addIssue(this, "type", dataset, config2);
      }
      return dataset;
    }
  };
}

// src/schemas/string/string.ts
// @__NO_SIDE_EFFECTS__
function string(message) {
  return {
    kind: "schema",
    type: "string",
    reference: string,
    expects: "string",
    async: false,
    message,
    get "~standard"() {
      return _getStandardProps(this);
    },
    "~run"(dataset, config2) {
      if (typeof dataset.value === "string") {
        dataset.typed = true;
      } else {
        _addIssue(this, "type", dataset, config2);
      }
      return dataset;
    }
  };
}

// src/methods/parse/parse.ts
function parse(schema, input, config2) {
  const dataset = schema["~run"]({
    value: input
  }, getGlobalConfig(config2));
  if (dataset.issues) {
    throw new ValiError(dataset.issues);
  }
  return dataset.value;
}

function handleError(logger, context, error) {
  const errorMessage = (error === null || error === void 0 ? void 0 : error.message) || String(error);
  logger.error(`Error in ${context}: ${errorMessage}`);
  throw new Error(errorMessage);
}

const SYSTEM_USER_ID$1 = '00000000-0000-0000-0000-000000000000';
const requestOtp = function (ctx, logger, nk, payload) {
  if (!payload) throw new Error('Payload is empty');
  try {
    const RequestOtpSchema = object({
      phone: string(),
      password: string()
    });
    const data = parse(RequestOtpSchema, JSON.parse(payload));
    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    nk.storageWrite([{
      collection: 'phone_verification',
      key: data.phone,
      userId: SYSTEM_USER_ID$1,
      value: {
        otp: otp,
        password: data.password,
        createdAt: Date.now()
      },
      permissionRead: 0,
      permissionWrite: 0
    }]);
    logger.info(`OTP for phone ${data.phone}: ${otp}`);
    return JSON.stringify({
      success: true
    });
  } catch (error) {
    return handleError(logger, 'requestOtp', error);
  }
};
const verifyOtp = function (ctx, logger, nk, payload) {
  if (!payload) throw new Error('Payload is empty');
  try {
    const VerifyOtpSchema = object({
      phone: string(),
      otp: string()
    });
    const data = parse(VerifyOtpSchema, JSON.parse(payload));
    const records = nk.storageRead([{
      collection: 'phone_verification',
      key: data.phone,
      userId: SYSTEM_USER_ID$1
    }]);
    if (records.length === 0) throw new Error('OTP not found or expired');
    const storedData = records[0].value;
    if (Date.now() - storedData.createdAt > 120000) throw new Error('OTP has expired');
    if (storedData.otp !== data.otp) throw new Error('Invalid OTP');
    nk.storageDelete([{
      collection: 'phone_verification',
      key: data.phone,
      userId: SYSTEM_USER_ID$1
    }]);
    const authResult = nk.authenticateCustom(data.phone, data.phone, true);
    nk.storageWrite([{
      collection: 'user_credentials',
      key: authResult.userId,
      userId: SYSTEM_USER_ID$1,
      value: {
        password: storedData.password
      },
      permissionRead: 0,
      permissionWrite: 0
    }]);
    const token = nk.authenticateTokenGenerate(authResult.userId, authResult.username, Math.floor(Date.now() / 1000) + 3600);
    return JSON.stringify({
      success: true,
      userId: authResult.userId,
      token: token
    });
  } catch (error) {
    return handleError(logger, 'verifyOtp', error);
  }
};
const loginWithPassword = function (ctx, logger, nk, payload) {
  if (!payload) throw new Error('Payload is empty');
  try {
    const LoginSchema = object({
      phone: string(),
      password: string()
    });
    const data = parse(LoginSchema, JSON.parse(payload));
    let authResult;
    try {
      authResult = nk.authenticateCustom(data.phone, data.phone, false);
    } catch (error) {
      throw new Error('User does not exist or incorrect credentials');
    }
    const credentials = nk.storageRead([{
      collection: 'user_credentials',
      key: authResult.userId,
      userId: SYSTEM_USER_ID$1
    }]);
    if (credentials.length === 0) {
      throw new Error('Incorrect credentials');
    }
    const storedPassword = credentials[0].value.password;
    if (storedPassword !== data.password) {
      throw new Error('Incorrect password');
    }
    const token = nk.authenticateTokenGenerate(authResult.userId, authResult.username, Math.floor(Date.now() / 1000) + 3600);
    return JSON.stringify({
      success: true,
      userId: authResult.userId,
      token: token
    });
  } catch (error) {
    return handleError(logger, 'loginWithPassword', error);
  }
};

const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000';
const setGameConfig = function (ctx, logger, nk, payload) {
  if (!ctx.userId) throw new Error('Unauthorized');
  if (!payload) throw new Error('Payload is empty');
  try {
    const account = nk.accountGetId(ctx.userId);
    const metadata = account.user.metadata || {};
    if (metadata.role !== 'admin') {
      throw new Error('Only admin can manage games');
    }
    const GameSchema = object({
      gameId: string(),
      gameName: string(),
      entryFee: number(),
      winnerReward: number(),
      loserReward: number(),
      maxPlayers: number(),
      xp: number()
    });
    const data = parse(GameSchema, JSON.parse(payload));
    nk.storageWrite([{
      collection: 'games',
      key: data.gameId,
      userId: SYSTEM_USER_ID,
      value: {
        gameName: data.gameName,
        entryFee: data.entryFee,
        winnerReward: data.winnerReward,
        loserReward: data.loserReward,
        maxPlayers: data.maxPlayers,
        xp: data.xp
      },
      permissionRead: 2,
      permissionWrite: 0
    }]);
    logger.info(`Game ${data.gameName} (${data.gameId}) created/updated by admin.`);
    return JSON.stringify({
      success: true
    });
  } catch (error) {
    return handleError(logger, 'setGameConfig', error);
  }
};
const getGameConfig = function (ctx, logger, nk, payload) {
  if (!payload) throw new Error('Payload is empty');
  try {
    const GetGameSchema = object({
      gameId: string()
    });
    const data = parse(GetGameSchema, JSON.parse(payload));
    const records = nk.storageRead([{
      collection: 'games',
      key: data.gameId,
      userId: SYSTEM_USER_ID
    }]);
    if (records.length === 0) {
      throw new Error('Game not found');
    }
    return JSON.stringify({
      success: true,
      game: records[0].value
    });
  } catch (error) {
    return handleError(logger, 'getGameConfig', error);
  }
};

const LEADERBOARD_ID = 'weekly_coins_leaderboard';
function initLeaderboard(ctx, logger, nk) {
  try {
    const authoritative = true;
    const sortOrder = "descending";
    const operator = "set";
    const resetSchedule = '0 0 * * 0';
    nk.leaderboardCreate(LEADERBOARD_ID, authoritative, sortOrder, operator, resetSchedule, {});
    logger.info(`Leaderboard '${LEADERBOARD_ID}' created or already exists.`);
  } catch (error) {
    return handleError(logger, 'initLeaderboard', error);
  }
}
const onLeaderboardReset = function (ctx, logger, nk, leaderboard, expiryTime) {
  try {
    if (leaderboard.id !== LEADERBOARD_ID) return;
    logger.info(`Leaderboard ${leaderboard.id} has reset. Fetching top 3 players...`);
    const result = nk.leaderboardRecordsList(LEADERBOARD_ID, undefined, 3, undefined, expiryTime);
    const records = result.records || [];
    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      const userId = record.ownerId;
      const changeset = {
        coins: 300
      };
      const metadata = {
        reason: 'Weekly leaderboard top 3 reward'
      };
      nk.walletUpdate(userId, changeset, metadata, true);
      logger.info(`Awarded 300 coins to user ${userId} for placing in top 3.`);
    }
  } catch (error) {
    return handleError(logger, 'onLeaderboardReset', error);
  }
};

function InitModule(ctx, logger, nk, initializer) {
  globalThis.afterAuthenticateDevice = afterAuthenticateDevice;
  globalThis.onLeaderboardReset = onLeaderboardReset;
  initLeaderboard(ctx, logger, nk);
  initializer.registerAfterAuthenticateDevice(afterAuthenticateDevice);
  initializer.registerLeaderboardReset(onLeaderboardReset);
  initializer.registerRpc("request_otp", requestOtp);
  initializer.registerRpc("verify_otp", verifyOtp);
  initializer.registerRpc("loginWithPassword", loginWithPassword);
  initializer.registerRpc("setGameConfig", setGameConfig);
  initializer.registerRpc("getGameConfig", getGameConfig);
  initializer.registerRpc("get_shop_items", getShopItemsRpc);
  initializer.registerRpc("get_inventory", getInventoryRpc);
  initializer.registerRpc("set_active_item", setActiveItemRpc);
  initializer.registerRpc("buy_item", buyItemRpc);
  logger.info('JavaScript logic loaded.');
}
!InitModule && InitModule.bind(null);
