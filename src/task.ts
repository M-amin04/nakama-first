export const afterAuthenticateDevice: nkruntime.AfterHookFunction<nkruntime.Session, nkruntime.AuthenticateDeviceRequest> = function (
    ctx: nkruntime.Context,
    logger: nkruntime.Logger,
    nk: nkruntime.Nakama,
    data: nkruntime.Session, 
    request: nkruntime.AuthenticateDeviceRequest
) {
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

        const metadata = { comment: 'Initial sign-up rewards' };
        nk.walletUpdate(userId, initialWallet, metadata, true);

    } catch (error) {
        logger.error(`Failed to initialize new user account: ${String(error)}`);
    }
};



export const getShopItemsRpc: nkruntime.RpcFunction = function(
    ctx: nkruntime.Context,
    logger: nkruntime.Logger,
    nk: nkruntime.Nakama,
    payload: string
) {
    const userId = '00000000-0000-0000-0000-000000000000';

    try {
        const objectids: nkruntime.StorageReadRequest[] = [
        {
            collection: 'configs',
            key: 'shop',
            userId: userId
        }
    ];

    const record = nk.storageRead(objectids);
    if(record.length === 0)
        return JSON.stringify({ items: [] });

    const shopdata = record[0].value;
    return JSON.stringify(shopdata)

    } catch (error) {
        logger.error(`Failed to fetch shop: ${String(error)}`);
        throw new Error('Internal server error during fetching shop.')
    }
}




export const getInventoryRpc: nkruntime.RpcFunction = function(
    ctx: nkruntime.Context,
    logger: nkruntime.Logger,
    nk: nkruntime.Nakama,
    payload: string
) {
    const userId = ctx.userId;
    if (!userId) {
        throw new Error('User ID not found in context.');
    }

    try {
        const objectIds: nkruntime.StorageReadRequest[] = [
            {
                collection: 'inventory',
                key: 'items',
                userId: userId
            }
        ];

        const records = nk.storageRead(objectIds);
        
        if (records.length === 0) {
            return JSON.stringify({ items: [] });
        }

        const inventoryData = records[0].value;
        return JSON.stringify(inventoryData);

    } catch (error) {
        logger.error(`Failed to fetch inventory: ${String(error)}`);
        throw new Error(`Internal server error during fetching inventory.`);
    }
}






export const setActiveItemRpc: nkruntime.RpcFunction = function (
    ctx: nkruntime.Context,
    logger: nkruntime.Logger,
    nk: nkruntime.Nakama,
    payload: string
) {
    const userId = ctx.userId;
    if (!userId) {
        throw new Error('User ID not found in context.');
    }

    if (!payload) {
        throw new Error('Payload is empty.');
    }

    let input: { itemType: string, itemId: string };

    try {
        input = JSON.parse(payload)
    } catch (error) {
        throw new Error('Invalid JSON payload.');
    }

    if (!input.itemType || !input.itemId) {
        throw new Error('Missing itemType or itemId in payload.');
    }

    try {
        const inventoryObjectIds: nkruntime.StorageReadRequest[] = [{
            collection: "inventory",
            key: "items",
            userId: userId 
        }];

        const records = nk.storageRead(inventoryObjectIds);

        let inventoryItems: string[] = [];
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
        let metadata: Record<string, any> = {};

        if (account.user && account.user.metadata)
            metadata = account.user.metadata

        if (!metadata.activeItems)
            metadata.activeItems = {};
        
        metadata.activeItems[input.itemType] = input.itemId;


        nk.accountUpdateId(userId, null, null, null, null, null, null, metadata);
                
        return JSON.stringify({ success: true, activeItems: metadata.activeItems });
    } catch (error) {
        logger.error(`Failed to set active item: ${String(error)}`);
        throw new Error(`Internal server error during item equipment.`);
    }
};






export const buyItemRpc: nkruntime.RpcFunction = function(
    ctx: nkruntime.Context,
    logger: nkruntime.Logger,
    nk: nkruntime.Nakama,
    payload: string
) {
    const userId = ctx.userId;
    if (!userId) {
        throw new Error('User ID not found in context.');
    }

    if (!payload) {
        throw new Error('Payload is empty.');
    }

    let input: { itemId: string };
    try {
        input = JSON.parse(payload);
    } catch (error) {
        throw new Error('Invalid JSON payload.');
    }

    if (!input.itemId) {
        throw new Error('Missing itemId in payload.');
    }

    const systemUserId = '00000000-0000-0000-0000-000000000000';
    const shopObjectIds: nkruntime.StorageReadRequest[] = [{
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
        const inventoryObjectIds: nkruntime.StorageReadRequest[] = [{
            collection: 'inventory',
            key: 'items',
            userId: userId
        }];

        const records = nk.storageRead(inventoryObjectIds);

        let inventoryItems: string[] = [];
        let version: string | null = null;

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

        const singlestorageWrite: nkruntime.StorageWriteRequest = {
                collection: 'inventory',
                key: 'items',
                userId: userId,
                value: { items: inventoryItems },
                permissionRead: 1,
                permissionWrite: 0,
        };

        if (version)
            singlestorageWrite.version = version;

        const storageWrites: nkruntime.StorageWriteRequest[] = [singlestorageWrite]

        const walletUpdates: nkruntime.WalletUpdate[] = [
            {
                userId: userId,
                changeset: { coins: -itemPrice }
            }
        ];

        const accountUpdates: nkruntime.UserUpdateAccount[] = [];
        const storageDeletes: nkruntime.StorageDeleteRequest[] = [];

        const result = nk.multiUpdate(accountUpdates, storageWrites, storageDeletes, walletUpdates, true);

        logger.info(`buy is success! Storage Acks: ${result.storageWriteAcks.length}, Wallet Acks: ${result.walletUpdateAcks.length}`);

        return JSON.stringify({
            success: true,
            boughtItem: input.itemId,
            inventory: inventoryItems
        });

    } catch (error: any) {
        logger.error(`Shop purchase failed: ${error.message || String(error)}`);
        throw error;
    }
};