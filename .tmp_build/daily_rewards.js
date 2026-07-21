"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rpcReward = rpcReward;
exports.msecToSec = msecToSec;
function rpcReward(context, logger, nk, payload) {
    if (!context.userId) {
        throw Error('No user ID in context');
    }
    if (payload) {
        throw Error('no input allowed');
    }
    var objectId = {
        collection: 'reward',
        key: 'daily',
        userId: context.userId,
    };
    var objects;
    try {
        objects = nk.storageRead([objectId]);
    }
    catch (error) {
        logger.error('storageRead error: %s', error);
        throw error;
    }
    var dailyReward = {
        lastClaimUnix: 0,
    };
    objects.forEach((object) => {
        if (object.key == 'daily') {
            dailyReward = object.value;
        }
    });
    var resp = {
        coinsReceived: 0,
    };
    var d = new Date();
    d.setHours(0, 0, 0, 0);
    if (dailyReward.lastClaimUnix < msecToSec(d.getTime())) {
        resp.coinsReceived = 500;
        var changeset = {
            coins: resp.coinsReceived,
        };
        try {
            nk.walletUpdate(context.userId, changeset, {}, false);
        }
        catch (error) {
            logger.error('walletUpdate error: %q', error);
            throw error;
        }
        var notification = {
            code: 1001,
            content: changeset,
            persistent: true,
            subject: "You've received your daily reward!",
            userId: context.userId,
        };
        try {
            nk.notificationsSend([notification]);
        }
        catch (error) {
            logger.error('notificationsSend error: %q', error);
            throw error;
        }
        dailyReward.lastClaimUnix = msecToSec(Date.now());
        var write = {
            collection: 'reward',
            key: 'daily',
            permissionRead: 1,
            permissionWrite: 0,
            value: dailyReward,
            userId: context.userId,
        };
        if (objects.length > 0) {
            write.version = objects[0].version;
        }
        try {
            nk.storageWrite([write]);
        }
        catch (error) {
            logger.error('storageWrite error: %q', error);
            throw error;
        }
    }
    var result = JSON.stringify(resp);
    logger.debug('rpcReward resp: %q', result);
    return result;
}
function msecToSec(n) {
    return Math.floor(n / 1000);
}
