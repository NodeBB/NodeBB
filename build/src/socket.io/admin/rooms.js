'use strict';
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
const os = require('os');
const nconf_1 = __importDefault(require("nconf"));
const topics = require('../../topics');
const pubsub = require('../../pubsub').default;
const utils = require('../../utils');
const stats = {};
const totals = {};
const SocketRooms = {};
SocketRooms.stats = stats;
SocketRooms.totals = totals;
pubsub.on('sync:stats:start', () => {
    const stats = SocketRooms.getLocalStats();
    pubsub.publish('sync:stats:end', {
        stats: stats,
        id: `${os.hostname()}:${nconf_1.default.get('port')}`,
    });
});
pubsub.on('sync:stats:end', (data) => {
    stats[data.id] = data.stats;
});
pubsub.on('sync:stats:guests', (eventId) => {
    const Sockets = require('../index');
    const guestCount = Sockets.getCountInRoom('online_guests');
    pubsub.publish(eventId, guestCount);
});
SocketRooms.getTotalGuestCount = function (callback) {
    let count = 0;
    const eventId = `sync:stats:guests:end:${utils.generateUUID()}`;
    pubsub.on(eventId, (guestCount) => {
        count += guestCount;
    });
    pubsub.publish('sync:stats:guests', eventId);
    setTimeout(() => {
        pubsub.removeAllListeners(eventId);
        callback(null, count);
    }, 100);
};
SocketRooms.getAll = function () {
    return __awaiter(this, void 0, void 0, function* () {
        pubsub.publish('sync:stats:start');
        totals.onlineGuestCount = 0;
        totals.onlineRegisteredCount = 0;
        totals.socketCount = 0;
        totals.topics = {};
        totals.users = {
            categories: 0,
            recent: 0,
            unread: 0,
            topics: 0,
            category: 0,
        };
        for (const instance of Object.values(stats)) {
            totals.onlineGuestCount += instance.onlineGuestCount;
            totals.onlineRegisteredCount += instance.onlineRegisteredCount;
            totals.socketCount += instance.socketCount;
            totals.users.categories += instance.users.categories;
            totals.users.recent += instance.users.recent;
            totals.users.unread += instance.users.unread;
            totals.users.topics += instance.users.topics;
            totals.users.category += instance.users.category;
            instance.topics.forEach((topic) => {
                totals.topics[topic.tid] = totals.topics[topic.tid] || { count: 0, tid: topic.tid };
                totals.topics[topic.tid].count += topic.count;
            });
        }
        let topTenTopics = [];
        Object.keys(totals.topics).forEach((tid) => {
            topTenTopics.push({ tid: tid, count: totals.topics[tid].count || 0 });
        });
        topTenTopics = topTenTopics.sort((a, b) => b.count - a.count).slice(0, 10);
        const topTenTids = topTenTopics.map((topic) => topic.tid);
        const titles = yield topics.getTopicsFields(topTenTids, ['title']);
        totals.topTenTopics = topTenTopics.map((topic, index) => {
            topic.title = titles[index].title;
            return topic;
        });
        return totals;
    });
};
SocketRooms.getOnlineUserCount = function (io) {
    let count = 0;
    if (io) {
        for (const [key] of io.sockets.adapter.rooms) {
            if (key.startsWith('uid_')) {
                count += 1;
            }
        }
    }
    return count;
};
SocketRooms.getLocalStats = function () {
    const Sockets = require('../index');
    const io = Sockets.server;
    const socketData = {
        onlineGuestCount: 0,
        onlineRegisteredCount: 0,
        socketCount: 0,
        users: {
            categories: 0,
            recent: 0,
            unread: 0,
            topics: 0,
            category: 0,
        },
        topics: {},
    };
    if (io && io.sockets) {
        socketData.onlineGuestCount = Sockets.getCountInRoom('online_guests');
        socketData.onlineRegisteredCount = SocketRooms.getOnlineUserCount(io);
        socketData.socketCount = io.sockets.sockets.size;
        socketData.users.categories = Sockets.getCountInRoom('categories');
        socketData.users.recent = Sockets.getCountInRoom('recent_topics');
        socketData.users.unread = Sockets.getCountInRoom('unread_topics');
        let topTenTopics = [];
        let tid;
        for (const [room, clients] of io.sockets.adapter.rooms) {
            tid = room.match(/^topic_(\d+)/);
            if (tid) {
                socketData.users.topics += clients.size;
                topTenTopics.push({ tid: tid[1], count: clients.size });
            }
            else if (room.match(/^category/)) {
                socketData.users.category += clients.size;
            }
        }
        topTenTopics = topTenTopics.sort((a, b) => b.count - a.count).slice(0, 10);
        socketData.topics = topTenTopics;
    }
    return socketData;
};
require('../../promisify').promisify(SocketRooms);
