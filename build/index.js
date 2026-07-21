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
    coin: 1000,
    xp: 0
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
//#region src/utils/_joinExpects/_joinExpects.ts
/**
* Joins multiple `expects` values with the given separator.
*
* @param values The `expects` values.
* @param separator The separator.
*
* @returns The joined `expects` property.
*
* @internal
*/
/* @__NO_SIDE_EFFECTS__ */
function _joinExpects(values$1, separator) {
  const list = [...new Set(values$1)];
  if (list.length > 1) return `(${list.join(` ${separator} `)})`;
  return list[0] ?? "never";
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
//#region src/schemas/enum/enum.ts
/* @__NO_SIDE_EFFECTS__ */
function enum_(enum__, message$1) {
  const options = [];
  for (const key in enum__) if (`${+key}` !== key || typeof enum__[key] !== "string" || !Object.is(enum__[enum__[key]], +key)) options.push(enum__[key]);
  return {
    kind: "schema",
    type: "enum",
    reference: enum_,
    expects: /* @__PURE__ */_joinExpects(options.map(_stringify), "|"),
    async: false,
    enum: enum__,
    options,
    message: message$1,
    get "~standard"() {
      return /* @__PURE__ */_getStandardProps(this);
    },
    "~run"(dataset, config$1) {
      if (this.options.includes(dataset.value)) dataset.typed = true;else _addIssue(this, "type", dataset, config$1);
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

var NakamaErrorCode;
(function (NakamaErrorCode) {
  NakamaErrorCode[NakamaErrorCode["OK"] = 0] = "OK";
  NakamaErrorCode[NakamaErrorCode["CANCELLED"] = 1] = "CANCELLED";
  NakamaErrorCode[NakamaErrorCode["UNKNOWN"] = 2] = "UNKNOWN";
  NakamaErrorCode[NakamaErrorCode["INVALID_ARGUMENT"] = 3] = "INVALID_ARGUMENT";
  NakamaErrorCode[NakamaErrorCode["DEADLINE_EXCEEDED"] = 4] = "DEADLINE_EXCEEDED";
  NakamaErrorCode[NakamaErrorCode["NOT_FOUND"] = 5] = "NOT_FOUND";
  NakamaErrorCode[NakamaErrorCode["ALREADY_EXISTS"] = 6] = "ALREADY_EXISTS";
  NakamaErrorCode[NakamaErrorCode["PERMISSION_DENIED"] = 7] = "PERMISSION_DENIED";
  NakamaErrorCode[NakamaErrorCode["RESOURCE_EXHAUSTED"] = 8] = "RESOURCE_EXHAUSTED";
  NakamaErrorCode[NakamaErrorCode["FAILED_PRECONDITION"] = 9] = "FAILED_PRECONDITION";
  NakamaErrorCode[NakamaErrorCode["ABORTED"] = 10] = "ABORTED";
  NakamaErrorCode[NakamaErrorCode["OUT_OF_RANGE"] = 11] = "OUT_OF_RANGE";
  NakamaErrorCode[NakamaErrorCode["UNIMPLEMENTED"] = 12] = "UNIMPLEMENTED";
  NakamaErrorCode[NakamaErrorCode["INTERNAL"] = 13] = "INTERNAL";
  NakamaErrorCode[NakamaErrorCode["UNAVAILABLE"] = 14] = "UNAVAILABLE";
  NakamaErrorCode[NakamaErrorCode["DATA_LOSS"] = 15] = "DATA_LOSS";
  NakamaErrorCode[NakamaErrorCode["UNAUTHENTICATED"] = 16] = "UNAUTHENTICATED";
})(NakamaErrorCode || (NakamaErrorCode = {}));
var ErrorMessage;
(function (ErrorMessage) {
  ErrorMessage["PAYLOAD_EMPTY"] = "Payload is empty.";
  ErrorMessage["UNAUTHORIZED"] = "Unauthorized.";
  ErrorMessage["ADMIN_ONLY"] = "Only admin can manage games.";
  ErrorMessage["INVALID_ARGUMENT"] = "Invalid argument.";
  ErrorMessage["USER_NOT_FOUND"] = "User does not exist or incorrect credentials.";
  ErrorMessage["INCORRECT_PASSWORD"] = "Incorrect password.";
  ErrorMessage["GAME_NOT_FOUND"] = "Game is not found.";
  ErrorMessage["OTP_NOT_FOUND"] = "OTP not found.";
  ErrorMessage["OTP_EXPIRED"] = "OTP has expired.";
  ErrorMessage["INVALID_OTP"] = "Invalid OTP.";
  ErrorMessage["INTERNAL_SERVER_ERROR"] = "Internal server error.";
  ErrorMessage["PHONE_ALREADY_REGISTERED"] = "This phone number is already registered to another account.";
})(ErrorMessage || (ErrorMessage = {}));
var MatchResultType;
(function (MatchResultType) {
  MatchResultType["WIN"] = "win";
  MatchResultType["LOSE"] = "lose";
})(MatchResultType || (MatchResultType = {}));
function handleError(ctx, logger, functionName, error) {
  logger.error(`Error in ${functionName}: ${(error === null || error === void 0 ? void 0 : error.message) || error}`);
  if (error && typeof error.code === 'number') {
    throw error;
  }
  const isProduction = ctx.env.NODE_ENV === 'production';
  if (isProduction) {
    throw {
      message: ErrorMessage.INTERNAL_SERVER_ERROR,
      code: NakamaErrorCode.INTERNAL
    };
  } else {
    throw {
      message: (error === null || error === void 0 ? void 0 : error.message) || String(error),
      code: NakamaErrorCode.INTERNAL
    };
  }
}

function checkUser(ctx) {
  if (!ctx.userId) {
    throw {
      message: ErrorMessage.UNAUTHORIZED,
      code: NakamaErrorCode.UNAUTHENTICATED
    };
  }
}
function checkPayload(payload) {
  if (!payload || payload.trim() === '' || payload === '{}') {
    throw {
      message: ErrorMessage.PAYLOAD_EMPTY,
      code: NakamaErrorCode.INVALID_ARGUMENT
    };
  }
}

const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000';
const AUTH_CONFIG = {
  TOKEN_EXPIRY_SECONDS: 3600,
  OTP_EXPIRY_MS: 120000,
  INITIAL_COIN: 1000,
  INITIAL_XP: 50
};
const STORAGE_COLLECTIONS = {
  USER_CREDENTIALS: 'user_credentials',
  PHONE_VERIFICATION: 'phone_verification',
  GAMES: 'games',
  PROCESSED_GAMES: 'processed_games',
  MATCH_HISTORY: 'match_history'
};
const LEADERBOARD_CONFIG = {
  ID: 'leaderboard',
  RESET_SCHEDULE: '0 0 * * 0',
  TOP_REWARDS: [300, 300, 300]
};

function generateUserToken(nk, userId, username) {
  return nk.authenticateTokenGenerate(userId, username, Math.floor(Date.now() / 1000) + AUTH_CONFIG.TOKEN_EXPIRY_SECONDS);
}
const requestOtp = function (ctx, logger, nk, payload) {
  checkPayload(payload);
  try {
    const RequestOtpSchema = object({
      phone: string(),
      password: string()
    });
    const data = parse(RequestOtpSchema, JSON.parse(payload));
    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    const hashedPassword = nk.bcryptHash(data.password);
    nk.storageWrite([{
      collection: STORAGE_COLLECTIONS.PHONE_VERIFICATION,
      key: data.phone,
      userId: SYSTEM_USER_ID,
      value: {
        otp: otp,
        password: hashedPassword
      },
      permissionRead: 0,
      permissionWrite: 0
    }]);
    return JSON.stringify({
      success: true
    });
  } catch (error) {
    return handleError(ctx, logger, 'requestOtp', error);
  }
};
const verifyOtp = function (ctx, logger, nk, payload) {
  checkPayload(payload);
  try {
    const VerifyOtpSchema = object({
      phone: string(),
      otp: string()
    });
    const data = parse(VerifyOtpSchema, JSON.parse(payload));
    const records = nk.storageRead([{
      collection: STORAGE_COLLECTIONS.PHONE_VERIFICATION,
      key: data.phone,
      userId: SYSTEM_USER_ID
    }]);
    if (records.length === 0) {
      throw {
        message: ErrorMessage.OTP_NOT_FOUND,
        code: NakamaErrorCode.NOT_FOUND
      };
    }
    const storedData = records[0].value;
    if (Date.now() - storedData.createdAt > 120000) {
      throw {
        message: ErrorMessage.OTP_EXPIRED,
        code: NakamaErrorCode.INVALID_ARGUMENT
      };
    }
    if (storedData.otp !== data.otp) {
      throw {
        message: ErrorMessage.INVALID_OTP,
        code: NakamaErrorCode.INVALID_ARGUMENT
      };
    }
    nk.storageDelete([{
      collection: 'phone_verification',
      key: data.phone,
      userId: SYSTEM_USER_ID
    }]);
    const authResult = nk.authenticateCustom(data.phone, data.phone, true);
    if (authResult.created) {
      nk.walletUpdate(authResult.userId, {
        coin: AUTH_CONFIG.INITIAL_COIN,
        xp: AUTH_CONFIG.INITIAL_COIN
      }, {
        reason: 'Initial registration bonus.'
      }, true);
    }
    nk.storageWrite([{
      collection: STORAGE_COLLECTIONS.USER_CREDENTIALS,
      key: authResult.userId,
      userId: SYSTEM_USER_ID,
      value: {
        phone: data.phone,
        password: storedData.password
      },
      permissionRead: 0,
      permissionWrite: 0
    }]);
    return JSON.stringify({
      success: true,
      userId: authResult.userId,
      token: generateUserToken(nk, authResult.userId, authResult.username)
    });
  } catch (error) {
    return handleError(ctx, logger, 'verifyOtp', error);
  }
};
const upgradeGuestAccount = function (ctx, logger, nk, payload) {
  checkUser(ctx);
  checkPayload(payload);
  try {
    const upgradeSchema = object({
      phone: string(),
      password: string()
    });
    const data = parse(upgradeSchema, JSON.parse(payload));
    let phoneExist = false;
    try {
      const testAuth = nk.authenticateCustom(data.phone, data.phone, false);
      if (testAuth.userId !== ctx.userId) phoneExist = true;
    } catch (e) {
      phoneExist = false;
    }
    if (phoneExist) {
      throw {
        message: ErrorMessage.PHONE_ALREADY_REGISTERED,
        code: NakamaErrorCode.ALREADY_EXISTS
      };
    }
    nk.accountUpdateId(ctx.userId, data.phone, ' ', null, null, null, null);
    const hashedPassword = nk.bcryptHash(data.password);
    nk.storageWrite([{
      collection: STORAGE_COLLECTIONS.USER_CREDENTIALS,
      key: ctx.userId,
      userId: SYSTEM_USER_ID,
      value: {
        phone: data.phone,
        password: hashedPassword
      },
      permissionRead: 0,
      permissionWrite: 0
    }]);
    return JSON.stringify({
      success: true,
      message: 'Account upgraded.',
      token: generateUserToken(nk, ctx.userId, data.phone)
    });
  } catch (error) {
    return handleError(ctx, logger, 'upgradeGuestAccount', error);
  }
};
const loginWithPassword = function (ctx, logger, nk, payload) {
  checkPayload(payload);
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
        message: ErrorMessage.USER_NOT_FOUND,
        code: NakamaErrorCode.UNAUTHENTICATED
      };
    }
    const credentials = nk.storageRead([{
      collection: STORAGE_COLLECTIONS.USER_CREDENTIALS,
      key: authResult.userId,
      userId: SYSTEM_USER_ID
    }]);
    if (credentials.length === 0) {
      throw {
        message: ErrorMessage.USER_NOT_FOUND,
        code: NakamaErrorCode.UNAUTHENTICATED
      };
    }
    const storedPassword = credentials[0].value.password;
    const isPasswordValid = nk.bcryptCompare(storedPassword, data.password);
    if (!isPasswordValid) {
      throw {
        message: ErrorMessage.INCORRECT_PASSWORD,
        code: NakamaErrorCode.UNAUTHENTICATED
      };
    }
    return JSON.stringify({
      success: true,
      userId: authResult.userId,
      token: generateUserToken(nk, authResult.userId, authResult.username)
    });
  } catch (error) {
    return handleError(ctx, logger, 'loginWithPassword', error);
  }
};

const setGameConfig = function (ctx, logger, nk, payload) {
  checkUser(ctx);
  checkPayload(payload);
  try {
    const account = nk.accountGetId(ctx.userId);
    const metadata = account.user.metadata || {};
    if (metadata.role !== 'admin') {
      throw {
        message: ErrorMessage.ADMIN_ONLY,
        code: NakamaErrorCode.PERMISSION_DENIED
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
      collection: STORAGE_COLLECTIONS.GAMES,
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
    return JSON.stringify({
      success: true
    });
  } catch (error) {
    return handleError(ctx, logger, 'setGameConfig', error);
  }
};
const getGameConfig = function (ctx, logger, nk, payload) {
  checkPayload(payload);
  try {
    const GetGameSchema = object({
      gameId: string()
    });
    const data = parse(GetGameSchema, JSON.parse(payload));
    const records = nk.storageRead([{
      collection: STORAGE_COLLECTIONS.GAMES,
      key: data.gameId,
      userId: SYSTEM_USER_ID
    }]);
    if (records.length === 0) {
      throw {
        message: ErrorMessage.GAME_NOT_FOUND,
        code: NakamaErrorCode.NOT_FOUND
      };
    }
    return JSON.stringify({
      success: true,
      game: records[0].value
    });
  } catch (error) {
    return handleError(ctx, logger, 'getGameConfig', error);
  }
};

function initLeaderboard(ctx, logger, nk) {
  try {
    nk.leaderboardCreate(LEADERBOARD_CONFIG.ID, true, "descending", "set", LEADERBOARD_CONFIG.RESET_SCHEDULE, {});
  } catch (error) {
    logger.error(`Error in initLeaderboard: ${(error === null || error === void 0 ? void 0 : error.message) || String(error)}`);
  }
}
const onLeaderboardReset = function (ctx, logger, nk, leaderboard, expiryTime) {
  try {
    if (leaderboard.id !== LEADERBOARD_CONFIG.ID) return;
    const result = nk.leaderboardRecordsList(LEADERBOARD_CONFIG.ID, undefined, 3, undefined, expiryTime);
    const records = result.records || [];
    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      const userId = record.ownerId;
      const coinReward = LEADERBOARD_CONFIG.TOP_REWARDS[i] || 100;
      nk.walletUpdate(userId, {
        coin: coinReward
      }, {
        reason: `Weekly leaderboard rank ${i + 1} reward.`
      }, true);
    }
  } catch (error) {
    logger.error(`Error in onLeaderboardReset: ${(error === null || error === void 0 ? void 0 : error.message) || String(error)}`);
  }
};

const MatchParticipantSchema = object({
  userId: string(),
  result: enum_(MatchResultType),
  score: number()
});
const MatchPayloadSchema = object({
  gameId: string(),
  participants: array(MatchParticipantSchema)
});
const calculateReward = (result, config) => {
  if (result === MatchResultType.WIN) return config.winnerReward || 0;
  if (result === MatchResultType.LOSE) return config.loserReward || 0;
  return 0;
};
const matchresult = function (ctx, logger, nk, payload) {
  try {
    const input = JSON.parse(payload || '{}');
    const parsed = safeParse(MatchPayloadSchema, input);
    if (!parsed.success) {
      throw {
        message: ErrorMessage.INVALID_ARGUMENT,
        code: NakamaErrorCode.INVALID_ARGUMENT
      };
    }
    const {
      gameId,
      participants
    } = parsed.output;
    const checkStored = nk.storageRead([{
      collection: STORAGE_COLLECTIONS.PROCESSED_GAMES,
      key: gameId,
      userId: SYSTEM_USER_ID
    }]);
    if (checkStored.length > 0) {
      return JSON.stringify({
        success: true,
        matchId: checkStored[0].value.matchId,
        alreadyProcessed: true
      });
    }
    const gameRecords = nk.storageRead([{
      collection: STORAGE_COLLECTIONS.GAMES,
      key: gameId,
      userId: SYSTEM_USER_ID
    }]);
    if (gameRecords.length === 0) {
      throw {
        message: ErrorMessage.GAME_NOT_FOUND,
        code: NakamaErrorCode.NOT_FOUND
      };
    }
    const gameConfig = gameRecords[0].value;
    const matchId = nk.uuidv4();
    nk.storageWrite([{
      collection: STORAGE_COLLECTIONS.PROCESSED_GAMES,
      key: gameId,
      userId: SYSTEM_USER_ID,
      value: {
        matchId,
        processedAt: Date.now()
      },
      permissionRead: 0,
      permissionWrite: 0
    }]);
    for (const player of participants) {
      const reward = calculateReward(player.result, gameConfig);
      const coinChangeSet = reward - (gameConfig.entryFee || 0);
      nk.walletUpdate(player.userId, {
        coin: Math.floor(coinChangeSet),
        xp: Math.floor(gameConfig.xp || 0)
      }, {
        matchId,
        gameName: gameConfig.gameName
      }, true);
      if (player.result === MatchResultType.WIN && player.score > 0) {
        nk.leaderboardRecordWrite(LEADERBOARD_CONFIG.ID, player.userId, player.userId, player.score);
      }
    }
    const notifications = participants.map(player => ({
      userId: player.userId,
      subject: `Game ${gameConfig.gameName} is over.`,
      content: {
        matchId,
        result: player.result,
        coin: calculateReward(player.result, gameConfig)
      },
      code: 1,
      senderId: SYSTEM_USER_ID,
      persistent: true
    }));
    nk.notificationsSend(notifications);
    nk.storageWrite([{
      collection: STORAGE_COLLECTIONS.MATCH_HISTORY,
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
    return handleError(ctx, logger, 'matchresult', error);
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
