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
      collection: 'inventory',
      key: 'items',
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
    collection: 'configs',
    key: 'shop',
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

//#region src/storages/globalConfig/globalConfig.ts
const DEFAULT_CONFIG = {
  lang: void 0,
  message: void 0,
  abortEarly: void 0,
  abortPipeEarly: void 0
};
/**
* Returns the global configuration.
*
* @param config The config to merge.
*
* @returns The configuration.
*/
/* @__NO_SIDE_EFFECTS__ */
function getGlobalConfig(config$1) {
  return DEFAULT_CONFIG;
}

//#endregion
//#region src/storages/globalMessage/globalMessage.ts
let store$3;
/**
* Returns a global error message.
*
* @param lang The language of the message.
*
* @returns The error message.
*/
/* @__NO_SIDE_EFFECTS__ */
function getGlobalMessage(lang) {
  return store$3?.get(lang);
}

//#endregion
//#region src/storages/schemaMessage/schemaMessage.ts
let store$2;
/**
* Returns a schema error message.
*
* @param lang The language of the message.
*
* @returns The error message.
*/
/* @__NO_SIDE_EFFECTS__ */
function getSchemaMessage(lang) {
  return store$2?.get(lang);
}

//#endregion
//#region src/storages/specificMessage/specificMessage.ts
let store$1;
/**
* Returns a specific error message.
*
* @param reference The identifier reference.
* @param lang The language of the message.
*
* @returns The error message.
*/
/* @__NO_SIDE_EFFECTS__ */
function getSpecificMessage(reference, lang) {
  return store$1?.get(reference)?.get(lang);
}

//#endregion
//#region src/utils/_stringify/_stringify.ts
/**
* Stringifies an unknown input to a literal or type string.
*
* @param input The unknown input.
*
* @returns A literal or type string.
*
* @internal
*/
/* @__NO_SIDE_EFFECTS__ */
function _stringify(input) {
  const type = typeof input;
  if (type === "string") return `"${input}"`;
  if (type === "number" || type === "bigint" || type === "boolean") return `${input}`;
  if (type === "object" || type === "function") return (input && Object.getPrototypeOf(input)?.constructor?.name) ?? "null";
  return type;
}

//#endregion
//#region src/utils/_addIssue/_addIssue.ts
/**
* Adds an issue to the dataset.
*
* @param context The issue context.
* @param label The issue label.
* @param dataset The input dataset.
* @param config The configuration.
* @param other The optional props.
*
* @internal
*/
function _addIssue(context, label, dataset, config$1, other) {
  const input = other && "input" in other ? other.input : dataset.value;
  const expected = other?.expected ?? context.expects ?? null;
  const received = other?.received ?? /* @__PURE__ */_stringify(input);
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
    lang: config$1.lang,
    abortEarly: config$1.abortEarly,
    abortPipeEarly: config$1.abortPipeEarly
  };
  const isSchema = context.kind === "schema";
  const message$1 = other?.message ?? context.message ?? /* @__PURE__ */getSpecificMessage(context.reference, issue.lang) ?? (isSchema ? /* @__PURE__ */getSchemaMessage(issue.lang) : null) ?? config$1.message ?? /* @__PURE__ */getGlobalMessage(issue.lang);
  if (message$1 !== void 0) issue.message = typeof message$1 === "function" ? message$1(issue) : message$1;
  if (isSchema) dataset.typed = false;
  if (dataset.issues) dataset.issues.push(issue);else dataset.issues = [issue];
}

//#endregion
//#region src/utils/_getStandardProps/_getStandardProps.ts
const _standardCache = /* @__PURE__ */new WeakMap();
/**
* Returns the Standard Schema properties.
*
* @param context The schema context.
*
* @returns The Standard Schema properties.
*/
/* @__NO_SIDE_EFFECTS__ */
function _getStandardProps(context) {
  let cached = _standardCache.get(context);
  if (!cached) {
    cached = {
      version: 1,
      vendor: "valibot",
      validate(value$1) {
        return context["~run"]({
          value: value$1
        }, /* @__PURE__ */getGlobalConfig());
      }
    };
    _standardCache.set(context, cached);
  }
  return cached;
}

//#endregion
//#region src/utils/ValiError/ValiError.ts
/**
* A Valibot error with useful information.
*/
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

//#endregion
//#region src/methods/getFallback/getFallback.ts
/**
* Returns the fallback value of the schema.
*
* @param schema The schema to get it from.
* @param dataset The output dataset if available.
* @param config The config if available.
*
* @returns The fallback value.
*/
/* @__NO_SIDE_EFFECTS__ */
function getFallback(schema, dataset, config$1) {
  return typeof schema.fallback === "function" ? schema.fallback(dataset, config$1) : schema.fallback;
}

//#endregion
//#region src/methods/getDefault/getDefault.ts
/**
* Returns the default value of the schema.
*
* @param schema The schema to get it from.
* @param dataset The input dataset if available.
* @param config The config if available.
*
* @returns The default value.
*/
/* @__NO_SIDE_EFFECTS__ */
function getDefault(schema, dataset, config$1) {
  return typeof schema.default === "function" ? schema.default(dataset, config$1) : schema.default;
}

//#endregion
//#region src/schemas/array/array.ts
/* @__NO_SIDE_EFFECTS__ */
function array(item, message$1) {
  return {
    kind: "schema",
    type: "array",
    reference: array,
    expects: "Array",
    async: false,
    item,
    message: message$1,
    get "~standard"() {
      return /* @__PURE__ */_getStandardProps(this);
    },
    "~run"(dataset, config$1) {
      const input = dataset.value;
      if (Array.isArray(input)) {
        dataset.typed = true;
        dataset.value = [];
        for (let key = 0; key < input.length; key++) {
          const value$1 = input[key];
          const itemDataset = this.item["~run"]({
            value: value$1
          }, config$1);
          if (itemDataset.issues) {
            const pathItem = {
              type: "array",
              origin: "value",
              input,
              key,
              value: value$1
            };
            for (const issue of itemDataset.issues) {
              if (issue.path) issue.path.unshift(pathItem);else issue.path = [pathItem];
              dataset.issues?.push(issue);
            }
            if (!dataset.issues) dataset.issues = itemDataset.issues;
            if (config$1.abortEarly) {
              dataset.typed = false;
              break;
            }
          }
          if (!itemDataset.typed) dataset.typed = false;
          dataset.value.push(itemDataset.value);
        }
      } else _addIssue(this, "type", dataset, config$1);
      return dataset;
    }
  };
}

//#endregion
//#region src/schemas/number/number.ts
/* @__NO_SIDE_EFFECTS__ */
function number(message$1) {
  return {
    kind: "schema",
    type: "number",
    reference: number,
    expects: "number",
    async: false,
    message: message$1,
    get "~standard"() {
      return /* @__PURE__ */_getStandardProps(this);
    },
    "~run"(dataset, config$1) {
      if (typeof dataset.value === "number" && !isNaN(dataset.value)) dataset.typed = true;else _addIssue(this, "type", dataset, config$1);
      return dataset;
    }
  };
}

//#endregion
//#region src/schemas/object/object.ts
/* @__NO_SIDE_EFFECTS__ */
function object(entries$1, message$1) {
  return {
    kind: "schema",
    type: "object",
    reference: object,
    expects: "Object",
    async: false,
    entries: entries$1,
    message: message$1,
    get "~standard"() {
      return /* @__PURE__ */_getStandardProps(this);
    },
    "~run"(dataset, config$1) {
      const input = dataset.value;
      if (input && typeof input === "object") {
        dataset.typed = true;
        dataset.value = {};
        for (const key in this.entries) {
          const valueSchema = this.entries[key];
          if (key in input || (valueSchema.type === "exact_optional" || valueSchema.type === "optional" || valueSchema.type === "nullish") && valueSchema.default !== void 0) {
            const value$1 = key in input ? input[key] : /* @__PURE__ */getDefault(valueSchema);
            const valueDataset = valueSchema["~run"]({
              value: value$1
            }, config$1);
            if (valueDataset.issues) {
              const pathItem = {
                type: "object",
                origin: "value",
                input,
                key,
                value: value$1
              };
              for (const issue of valueDataset.issues) {
                if (issue.path) issue.path.unshift(pathItem);else issue.path = [pathItem];
                dataset.issues?.push(issue);
              }
              if (!dataset.issues) dataset.issues = valueDataset.issues;
              if (config$1.abortEarly) {
                dataset.typed = false;
                break;
              }
            }
            if (!valueDataset.typed) dataset.typed = false;
            dataset.value[key] = valueDataset.value;
          } else if (valueSchema.fallback !== void 0) dataset.value[key] = /* @__PURE__ */getFallback(valueSchema);else if (valueSchema.type !== "exact_optional" && valueSchema.type !== "optional" && valueSchema.type !== "nullish") {
            _addIssue(this, "key", dataset, config$1, {
              input: void 0,
              expected: `"${key}"`,
              path: [{
                type: "object",
                origin: "key",
                input,
                key,
                value: input[key]
              }]
            });
            if (config$1.abortEarly) break;
          }
        }
      } else _addIssue(this, "type", dataset, config$1);
      return dataset;
    }
  };
}

//#endregion
//#region src/schemas/string/string.ts
/* @__NO_SIDE_EFFECTS__ */
function string(message$1) {
  return {
    kind: "schema",
    type: "string",
    reference: string,
    expects: "string",
    async: false,
    message: message$1,
    get "~standard"() {
      return /* @__PURE__ */_getStandardProps(this);
    },
    "~run"(dataset, config$1) {
      if (typeof dataset.value === "string") dataset.typed = true;else _addIssue(this, "type", dataset, config$1);
      return dataset;
    }
  };
}

//#endregion
//#region src/methods/parse/parse.ts
/**
* Parses an unknown input based on a schema.
*
* @param schema The schema to be used.
* @param input The input to be parsed.
* @param config The parse configuration.
*
* @returns The parsed input.
*/
function parse(schema, input, config$1) {
  const dataset = schema["~run"]({
    value: input
  }, /* @__PURE__ */getGlobalConfig());
  if (dataset.issues) throw new ValiError(dataset.issues);
  return dataset.value;
}

//#endregion
//#region src/methods/safeParse/safeParse.ts
/**
* Parses an unknown input based on a schema.
*
* @param schema The schema to be used.
* @param input The input to be parsed.
* @param config The parse configuration.
*
* @returns The parse result.
*/
/* @__NO_SIDE_EFFECTS__ */
function safeParse(schema, input, config$1) {
  const dataset = schema["~run"]({
    value: input
  }, /* @__PURE__ */getGlobalConfig());
  return {
    typed: dataset.typed,
    success: !dataset.issues,
    output: dataset.value,
    issues: dataset.issues
  };
}

const SYSTEM_USER_ID$2 = '00000000-0000-0000-0000-000000000000';
const requestOtp = function (ctx, logger, nk, payload) {
  if (!payload) {
    throw {
      message: 'Payload is empty.',
      code: 3
    };
  }
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
      userId: SYSTEM_USER_ID$2,
      value: {
        otp: otp,
        password: data.password,
        createdAt: Date.now()
      },
      permissionRead: 0,
      permissionWrite: 0
    }]);
    return JSON.stringify({
      success: true
    });
  } catch (error) {
    logger.error(`Error in requestOtp: ${(error === null || error === void 0 ? void 0 : error.Message) || error}`);
    if (error && typeof error.code === 'number') throw error;
    throw {
      message: error === null || error === void 0 ? void 0 : error.Message,
      code: 3
    };
  }
};
const verifyOtp = function (ctx, logger, nk, payload) {
  if (!payload) {
    throw {
      message: 'Payload is empty.',
      code: 3
    };
  }
  try {
    const VerifyOtpSchema = object({
      phone: string(),
      otp: string()
    });
    const data = parse(VerifyOtpSchema, JSON.parse(payload));
    const records = nk.storageRead([{
      collection: 'phone_verification',
      key: data.phone,
      userId: SYSTEM_USER_ID$2
    }]);
    if (records.length === 0) {
      throw {
        message: 'OTP not found or expired',
        code: 5
      };
    }
    const storedData = records[0].value;
    if (Date.now() - storedData.createdAt > 120000) {
      throw {
        message: 'OTP has expired',
        code: 3
      };
    }
    if (storedData.otp !== data.otp) {
      throw {
        message: 'Invalid OTP',
        code: 3
      };
    }
    nk.storageDelete([{
      collection: 'phone_verification',
      key: data.phone,
      userId: SYSTEM_USER_ID$2
    }]);
    const authResult = nk.authenticateCustom(data.phone, data.phone, true);
    if (authResult.created) {
      const initialCoins = 1000;
      const initialXp = 50;
      const changeset = {
        coin: initialCoins,
        xp: initialXp
      };
      const metadata = {
        reason: 'Initial registration bonus'
      };
      nk.walletUpdate(authResult.userId, changeset, metadata, true);
    }
    nk.storageWrite([{
      collection: 'user_credentials',
      key: authResult.userId,
      userId: SYSTEM_USER_ID$2,
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
    logger.error(`Error in verifyOtp: ${(error === null || error === void 0 ? void 0 : error.message) || error}`);
    if (error && typeof error.code === 'number') throw error;
    throw {
      message: (error === null || error === void 0 ? void 0 : error.message) || String(error),
      code: 3
    };
  }
};
const loginWithPassword = function (ctx, logger, nk, payload) {
  if (!payload) {
    throw {
      message: 'Payload is empty',
      code: 3
    };
  }
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
      throw {
        message: 'User does not exist or incorrect credentials',
        code: 16
      };
    }
    const credentials = nk.storageRead([{
      collection: 'user_credentials',
      key: authResult.userId,
      userId: SYSTEM_USER_ID$2
    }]);
    if (credentials.length === 0) {
      throw {
        message: 'Incorrect credentials',
        code: 16
      };
    }
    const storedPassword = credentials[0].value.password;
    if (storedPassword !== data.password) {
      throw {
        message: 'Incorrect password',
        code: 16
      };
    }
    const token = nk.authenticateTokenGenerate(authResult.userId, authResult.username, Math.floor(Date.now() / 1000) + 3600);
    return JSON.stringify({
      success: true,
      userId: authResult.userId,
      token: token
    });
  } catch (error) {
    logger.error(`Error in loginWithPassword: ${(error === null || error === void 0 ? void 0 : error.message) || error}`);
    if (error && typeof error.code === 'number') throw error;
    throw {
      message: (error === null || error === void 0 ? void 0 : error.message) || String(error),
      code: 3
    };
  }
};

const SYSTEM_USER_ID$1 = '00000000-0000-0000-0000-000000000000';
const setGameConfig = function (ctx, logger, nk, payload) {
  if (!ctx.userId) {
    throw {
      message: 'Unauthorized',
      code: 16
    };
  }
  if (!payload) {
    throw {
      message: 'Payload is empty',
      code: 3
    };
  }
  try {
    const account = nk.accountGetId(ctx.userId);
    const metadata = account.user.metadata || {};
    if (metadata.role !== 'admin') {
      throw {
        message: 'Only admin can manage games',
        code: 7
      };
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
      userId: SYSTEM_USER_ID$1,
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
    return JSON.stringify({
      success: true
    });
  } catch (error) {
    logger.error(`Error in setGameConfig: ${(error === null || error === void 0 ? void 0 : error.Message) || error}`);
    if (error && typeof error.code === 'number') throw error;
    throw {
      message: error === null || error === void 0 ? void 0 : error.Message,
      code: 3
    };
  }
};
const getGameConfig = function (ctx, logger, nk, payload) {
  if (!payload) {
    throw {
      message: 'Payload is empty',
      code: 3
    };
  }
  try {
    const GetGameSchema = object({
      gameId: string()
    });
    const data = parse(GetGameSchema, JSON.parse(payload));
    const records = nk.storageRead([{
      collection: 'games',
      key: data.gameId,
      userId: SYSTEM_USER_ID$1
    }]);
    if (records.length === 0) {
      throw {
        message: 'Game not found',
        code: 5
      };
    }
    return JSON.stringify({
      success: true,
      game: records[0].value
    });
  } catch (error) {
    logger.error(`Error in getGameConfig: ${(error === null || error === void 0 ? void 0 : error.Message) || error}`);
    if (error && typeof error.code === 'number') throw error;
    throw {
      message: error === null || error === void 0 ? void 0 : error.Message,
      code: 3
    };
  }
};

const LEADERBOARD_ID = 'leaderboard';
function initLeaderboard(ctx, logger, nk) {
  try {
    const authoritative = true;
    const sortOrder = "descending";
    const operator = "set";
    const resetSchedule = '0 0 * * 0';
    nk.leaderboardCreate(LEADERBOARD_ID, authoritative, sortOrder, operator, resetSchedule, {});
  } catch (error) {
    logger.error(`Error in initLeaderboard: ${(error === null || error === void 0 ? void 0 : error.message) || String(error)}`);
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
        coin: 300
      };
      const metadata = {
        reason: 'Weekly leaderboard top 3 reward'
      };
      nk.walletUpdate(userId, changeset, metadata, true);
    }
  } catch (error) {
    logger.error(`Error in onLeaderboardReset: ${(error === null || error === void 0 ? void 0 : error.message) || String(error)}`);
  }
};

const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000';
const MatchParticipantSchema = object({
  userId: string(),
  result: string(),
  score: number()
});
const MatchPayloadSchema = object({
  gameId: string(),
  participants: array(MatchParticipantSchema)
});
const matchresult = function (ctx, logger, nk, payload) {
  try {
    const input = JSON.parse(payload || '{}');
    const parsed = safeParse(MatchPayloadSchema, input);
    if (!parsed.success) {
      throw {
        message: 'Invalid argument',
        code: 3
      };
    }
    const {
      gameId,
      participants
    } = parsed.output;
    const gameRecords = nk.storageRead([{
      collection: 'games',
      key: gameId,
      userId: SYSTEM_USER_ID
    }]);
    if (gameRecords.length === 0) {
      throw {
        message: 'Game is not found',
        code: 5
      };
    }
    const gameConfig = gameRecords[0].value;
    const matchId = nk.uuidv4();
    for (const player of participants) {
      let coinChangeSet = -gameConfig.entryFee;
      if (player.result === 'win') {
        coinChangeSet += gameConfig.winnerReward;
      } else if (player.result === 'lose') {
        coinChangeSet += gameConfig.loserReward;
      }
      const changeset = {
        coin: Math.floor(coinChangeSet),
        xp: Math.floor(gameConfig.xp || 0)
      };
      const metadata = {
        matchId: matchId,
        gameName: gameConfig.gameName
      };
      nk.walletUpdate(player.userId, changeset, metadata, true);
      if (player.result === 'win' && player.score > 0) {
        nk.leaderboardRecordWrite('leaderboard', player.userId, ctx.username, player.score);
      }
    }
    const notifications = participants.map(player => {
      let coinChangeSet = -gameConfig.entryFee;
      if (player.result === 'win') {
        coinChangeSet += gameConfig.winnerReward;
      } else if (player.result === 'lose') {
        coinChangeSet += gameConfig.loserReward;
      }
      return {
        id: '',
        userId: player.userId,
        subject: `Game ${gameConfig.gameName} is over.`,
        content: {
          matchId: matchId,
          result: player.result,
          coins: coinChangeSet
        },
        code: 1,
        senderId: SYSTEM_USER_ID,
        persistent: true,
        createTime: Math.floor(Date.now() / 1000)
      };
    });
    nk.notificationsSend(notifications);
    nk.storageWrite([{
      collection: 'match_history',
      key: matchId,
      userId: SYSTEM_USER_ID,
      value: {
        matchId,
        gameId,
        gameName: gameConfig.gameName,
        time: Date.now(),
        players: participants
      },
      permissionRead: 2,
      permissionWrite: 0
    }]);
    return JSON.stringify({
      success: true,
      matchId
    });
  } catch (error) {
    logger.error(`Error in matchresult: ${(error === null || error === void 0 ? void 0 : error.Message) || error}`);
    if (error && typeof error.code === 'number') throw error;
    throw {
      message: error === null || error === void 0 ? void 0 : error.Message,
      code: 3
    };
  }
};

function InitModule(ctx, logger, nk, initializer) {
  globalThis.afterAuthenticateDevice = afterAuthenticateDevice;
  globalThis.onLeaderboardReset = onLeaderboardReset;
  initLeaderboard(ctx, logger, nk);
  initializer.registerAfterAuthenticateDevice(afterAuthenticateDevice);
  initializer.registerLeaderboardReset(onLeaderboardReset);
  initializer.registerRpc('request_otp', requestOtp);
  initializer.registerRpc('verify_otp', verifyOtp);
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
