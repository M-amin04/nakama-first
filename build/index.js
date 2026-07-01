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
  const randomNuericDisplayname = 'Guest_' + randomNumericUsername;
  const initialWallet = {
    coins: 1000,
    gems: 50
  };
  try {
    nk.accountUpdateId(userId, randomNumericUsername, randomNuericDisplayname, null, null, null, null);
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
  const userId = ctx.userId;
  if (!userId) {
    throw new Error('User ID not found in context.');
  }
  if (!payload) {
    throw new Error('Payload is empty.');
  }
  let input;
  try {
    input = JSON.parse(payload);
  } catch (error) {
    throw new Error('Invalid JSON payload.');
  }
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
  const userId = ctx.userId;
  if (!userId) {
    throw new Error('User ID not found in context.');
  }
  if (!payload) {
    throw new Error('Payload is empty.');
  }
  let input;
  try {
    input = JSON.parse(payload);
  } catch (error) {
    throw new Error('Invalid JSON payload.');
  }
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

function InitModule(ctx, logger, nk, initializer) {
  globalThis.afterAuthenticateDevice = afterAuthenticateDevice;
  initializer.registerAfterAuthenticateDevice(afterAuthenticateDevice);
  initializer.registerRpc("get_shop_items", getShopItemsRpc);
  initializer.registerRpc("get_inventory", getInventoryRpc);
  initializer.registerRpc("set_active_item", setActiveItemRpc);
  initializer.registerRpc("buy_item", buyItemRpc);
  logger.info('JavaScript logic loaded.');
}
!InitModule && InitModule.bind(null);
