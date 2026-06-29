const afterAuthenticateDevice = function (ctx, logger, nk, data, request) {
  if (!data.created) {
    logger.info(`User ${ctx.userId} already exists. Skipping initialization.`);
    return;
  }
  const userId = ctx.userId;
  if (!userId) {
    logger.error("User ID is undefined in context.");
    return;
  }
  const randomNumericUsername = Math.floor(10000000000 + Math.random() * 90000000000).toString();
  const randomNuericDisplayname = "Guest_" + randomNumericUsername;
  const initialWallet = {
    coins: 1000,
    gems: 50
  };
  try {
    nk.accountUpdateId(userId, randomNumericUsername, randomNuericDisplayname, null, null, null, null);
    logger.info(`Username updated for new user ${userId} to ${randomNumericUsername}`);
    const metadata = {
      comment: "Initial sign-up rewards"
    };
    nk.walletUpdate(userId, initialWallet, metadata, true);
    logger.info(`Initial wallet (coins/gems) credited for user ${userId}`);
  } catch (error) {
    logger.error(`Failed to initialize new user account: ${String(error)}`);
  }
};
const getInventoryRpc = function (ctx, logger, nk, payload) {
  const userId = ctx.userId;
  if (!userId) {
    throw new Error("User ID not found in context.");
  }
  try {
    const objectIds = [{
      collection: "inventory",
      key: "items",
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
    throw new Error("Internal server error during fetching inventory.");
  }
};
const setActiveItemRpc = function (ctx, logger, nk, payload) {
  const userId = ctx.userId;
  if (!userId) {
    throw new Error("User ID not found in context.");
  }
  if (!payload) {
    throw new Error("Payload is empty. Expecting item type and itemId.");
  }
  let input;
  try {
    input = JSON.parse(payload);
  } catch (e) {
    throw new Error("Invalid JSON payload.");
  }
  if (!input.itemType || !input.itemId) {
    throw new Error("Missing itemType or itemId in payload.");
  }
  try {
    const account = nk.accountGetId(userId);
    let metadata = {};
    if (account.user && account.user.metadata) {
      metadata = account.user.metadata;
    }
    if (!metadata.activeItems) {
      metadata.activeItems = {};
    }
    metadata.activeItems[input.itemType] = input.itemId;
    nk.accountUpdateId(userId, null, null, null, null, null, null, metadata);
    logger.info(`User ${userId} equipped ${input.itemId} as their active ${input.itemType}`);
    return JSON.stringify({
      success: true,
      activeItems: metadata.activeItems
    });
  } catch (error) {
    logger.error(`Failed to set active item: ${String(error)}`);
    throw new Error("Internal server error during item equipment.");
  }
};
const buyItemRpc = function (ctx, logger, nk, payload) {
  const userId = ctx.userId;
  if (!userId) throw new Error("User ID not found in context.");
  if (!payload) {
    throw new Error("Payload is empty. Expecting item type and itemId.");
  }
  let input;
  try {
    input = JSON.parse(payload);
  } catch (e) {
    throw new Error("Invalid JSON payload.");
  }
  if (!input.itemId) {
    throw new Error("Missing itemId in payload.");
  }
  const shopItems = {
    "Avatar_1": {
      price: 80,
      itemType: 'avatar'
    },
    "Avatar_2": {
      price: 40,
      itemType: 'avatar'
    },
    "dice_1": {
      price: 20,
      itemType: 'dice'
    },
    "dice_2": {
      price: 10,
      itemType: 'dice'
    }
  };
  const itemToBuy = shopItems[input.itemId];
  if (!itemToBuy) throw new Error("Item not found in shop.");
  try {
    const changeset = {
      coins: -itemToBuy.price
    };
    let updatedWallet;
    try {
      updatedWallet = nk.walletUpdate(userId, changeset, undefined, true);
    } catch (walletError) {
      logger.warn(`User ${userId} rejected due to insufficient funds.`);
      throw new Error("Insufficient funds. You don't have enough coins.");
    }
    const objectsIds = [{
      collection: "inventory",
      key: "items",
      userId: userId
    }];
    const records = nk.storageRead(objectsIds);
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
      nk.walletUpdate(userId, {
        coins: itemToBuy.price
      }, undefined, true);
      throw new Error("You already own this item.");
    }
    inventoryItems.push(input.itemId);
    const writeOp = {
      collection: 'inventory',
      key: 'items',
      userId: userId,
      value: {
        items: inventoryItems
      },
      permissionRead: 1,
      permissionWrite: 0
    };
    if (version) {
      writeOp.version = version;
    }
    nk.storageWrite([writeOp]);
    logger.info(`User ${userId} successfully bought ${input.itemId} for ${itemToBuy.price} coins.`);
    return JSON.stringify({
      success: true,
      boughtItem: input.itemId,
      remainingCoins: updatedWallet.updated.coins,
      inventory: inventoryItems
    });
  } catch (error) {
    logger.error(`Shop purchase failed: ${error.message || String(error)}`);
    throw error;
  }
};

function InitModule(ctx, logger, nk, initializer) {
  globalThis.afterAuthenticateDevice = afterAuthenticateDevice;
  globalThis.getInventoryRpc = getInventoryRpc;
  globalThis.setActiveItemRpc = setActiveItemRpc;
  globalThis.buyItemRpc = buyItemRpc;
  initializer.registerAfterAuthenticateDevice(afterAuthenticateDevice);
  initializer.registerRpc("get_inventory", getInventoryRpc);
  initializer.registerRpc("set_active_item", setActiveItemRpc);
  initializer.registerRpc("buy_item", buyItemRpc);
  logger.info('JavaScript logic loaded.');
}
!InitModule && InitModule.bind(null);
