'use strict';
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const _ = require('lodash');
const database = __importStar(require("../database"));
const db = database;
const meta_1 = __importDefault(require("../meta"));
const user_1 = __importDefault(require("../user"));
const posts = require('../posts');
const categories = require('../categories');
const plugins = require('../plugins');
const translator = require('../translator');
const privileges = require('../privileges');
const Events = {};
/**
 * Note: Plugins!
 *
 * You are able to define additional topic event types here.
 * Register to hook `filter:topicEvents.init` and append your custom type to the `types` object.
 * You can then log a custom topic event by calling `topics.events.log(tid, { type, uid });`
 * `uid` is optional; if you pass in a valid uid in the payload,
 * the user avatar/username will be rendered as part of the event text
 *
 */
Events._types = {
    pin: {
        icon: 'fa-thumb-tack',
        text: '[[topic:pinned-by]]',
    },
    unpin: {
        icon: 'fa-thumb-tack fa-rotate-90',
        text: '[[topic:unpinned-by]]',
    },
    lock: {
        icon: 'fa-lock',
        text: '[[topic:locked-by]]',
    },
    unlock: {
        icon: 'fa-unlock',
        text: '[[topic:unlocked-by]]',
    },
    delete: {
        icon: 'fa-trash',
        text: '[[topic:deleted-by]]',
    },
    restore: {
        icon: 'fa-trash-o',
        text: '[[topic:restored-by]]',
    },
    move: {
        icon: 'fa-arrow-circle-right',
        // text: '[[topic:moved-from-by]]',
    },
    'post-queue': {
        icon: 'fa-history',
        text: '[[topic:queued-by]]',
        href: '/post-queue',
    },
    backlink: {
        icon: 'fa-link',
        text: '[[topic:backlink]]',
    },
    fork: {
        icon: 'fa-code-fork',
        text: '[[topic:forked-by]]',
    },
};
Events.init = () => __awaiter(void 0, void 0, void 0, function* () {
    // Allow plugins to define additional topic event types
    const { types } = yield plugins.hooks.fire('filter:topicEvents.init', { types: Events._types });
    Events._types = types;
});
Events.get = (tid, uid, reverse = false) => __awaiter(void 0, void 0, void 0, function* () {
    const topics = require('.');
    if (!(yield topics.exists(tid))) {
        throw new Error('[[error:no-topic]]');
    }
    let eventIds = yield db.getSortedSetRangeWithScores(`topic:${tid}:events`, 0, -1);
    const keys = eventIds.map(obj => `topicEvent:${obj.value}`);
    const timestamps = eventIds.map(obj => obj.score);
    eventIds = eventIds.map(obj => obj.value);
    let events = yield db.getObjects(keys);
    events = yield modifyEvent({ tid, uid, eventIds, timestamps, events });
    if (reverse) {
        events.reverse();
    }
    return events;
});
function getUserInfo(uids) {
    return __awaiter(this, void 0, void 0, function* () {
        uids = uids.filter((uid, idx) => !isNaN(parseInt(uid, 10)) && uids.indexOf(uid) === idx);
        const userData = yield user_1.default.getUsersFields(uids, ['picture', 'username', 'userslug']);
        const userMap = userData.reduce((memo, cur) => memo.set(cur.uid, cur), new Map());
        userMap.set('system', {
            system: true,
        });
        return userMap;
    });
}
function getCategoryInfo(cids) {
    return __awaiter(this, void 0, void 0, function* () {
        const uniqCids = _.uniq(cids);
        const catData = yield categories.getCategoriesFields(uniqCids, ['name', 'slug', 'icon', 'color', 'bgColor']);
        return _.zipObject(uniqCids, catData);
    });
}
function modifyEvent({ tid, uid, eventIds, timestamps, events }) {
    return __awaiter(this, void 0, void 0, function* () {
        // Add posts from post queue
        const isPrivileged = yield user_1.default.isPrivileged(uid);
        if (isPrivileged) {
            const queuedPosts = yield posts.getQueuedPosts({ tid }, { metadata: false });
            events.push(...queuedPosts.map((item) => ({
                type: 'post-queue',
                timestamp: item.data.timestamp || Date.now(),
                uid: item.data.uid,
            })));
            queuedPosts.forEach((item) => {
                timestamps.push(item.data.timestamp || Date.now());
            });
        }
        const [users, fromCategories] = yield Promise.all([
            getUserInfo(events.map(event => event.uid).filter(Boolean)),
            getCategoryInfo(events.map(event => event.fromCid).filter(Boolean)),
        ]);
        // Remove backlink events if backlinks are disabled
        if (meta_1.default.config.topicBacklinks !== 1) {
            events = events.filter(event => event.type !== 'backlink');
        }
        else {
            // remove backlinks that we dont have read permission
            const backlinkPids = events.filter(e => e.type === 'backlink')
                .map(e => e.href.split('/').pop());
            const pids = yield privileges.posts.filter('topics:read', backlinkPids, uid);
            events = events.filter(e => e.type !== 'backlink' || pids.includes(e.href.split('/').pop()));
        }
        // Remove events whose types no longer exist (e.g. plugin uninstalled)
        events = events.filter(event => Events._types.hasOwnProperty(event.type));
        // Add user & metadata
        events.forEach((event, idx) => {
            event.id = parseInt(eventIds[idx], 10);
            event.timestamp = timestamps[idx];
            event.timestampISO = new Date(timestamps[idx]).toISOString();
            if (event.hasOwnProperty('uid')) {
                event.user = users.get(event.uid === 'system' ? 'system' : parseInt(event.uid, 10));
            }
            if (event.hasOwnProperty('fromCid')) {
                event.fromCategory = fromCategories[event.fromCid];
                event.text = translator.compile('topic:moved-from-by', event.fromCategory.name);
            }
            Object.assign(event, Events._types[event.type]);
        });
        // Sort events
        events.sort((a, b) => a.timestamp - b.timestamp);
        return events;
    });
}
Events.log = (tid, payload) => __awaiter(void 0, void 0, void 0, function* () {
    const topics = require('.');
    const { type } = payload;
    const timestamp = payload.timestamp || Date.now();
    if (!Events._types.hasOwnProperty(type)) {
        throw new Error(`[[error:topic-event-unrecognized, ${type}]]`);
    }
    else if (!(yield topics.exists(tid))) {
        throw new Error('[[error:no-topic]]');
    }
    const eventId = yield db.incrObjectField('global', 'nextTopicEventId');
    yield Promise.all([
        db.setObject(`topicEvent:${eventId}`, payload),
        db.sortedSetAdd(`topic:${tid}:events`, timestamp, eventId),
    ]);
    let events = yield modifyEvent({
        eventIds: [eventId],
        timestamps: [timestamp],
        events: [payload],
    });
    ({ events } = yield plugins.hooks.fire('filter:topic.events.log', { events }));
    return events;
});
Events.purge = (tid, eventIds = []) => __awaiter(void 0, void 0, void 0, function* () {
    if (eventIds.length) {
        const isTopicEvent = yield db.isSortedSetMembers(`topic:${tid}:events`, eventIds);
        eventIds = eventIds.filter((id, index) => isTopicEvent[index]);
        yield Promise.all([
            db.sortedSetRemove(`topic:${tid}:events`, eventIds),
            db.deleteAll(eventIds.map(id => `topicEvent:${id}`)),
        ]);
    }
    else {
        const keys = [`topic:${tid}:events`];
        const eventIds = yield db.getSortedSetRange(keys[0], 0, -1);
        keys.push(...eventIds.map(id => `topicEvent:${id}`));
        yield db.deleteAll(keys);
    }
});
