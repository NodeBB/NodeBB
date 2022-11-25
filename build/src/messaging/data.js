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
const validator = require('validator');
const database = __importStar(require("../database"));
const db = database;
const user_1 = __importDefault(require("../user"));
const utils = require('../utils');
const plugins = require('../plugins');
const intFields = ['timestamp', 'edited', 'fromuid', 'roomId', 'deleted', 'system'];
function default_1(Messaging) {
    Messaging.newMessageCutoff = 1000 * 60 * 3;
    Messaging.getMessagesFields = (mids, fields) => __awaiter(this, void 0, void 0, function* () {
        if (!Array.isArray(mids) || !mids.length) {
            return [];
        }
        const keys = mids.map(mid => `message:${mid}`);
        const messages = yield db.getObjects(keys, fields);
        return yield Promise.all(messages.map((message, idx) => __awaiter(this, void 0, void 0, function* () { return modifyMessage(message, fields, parseInt(mids[idx], 10)); })));
    });
    Messaging.getMessageField = (mid, field) => __awaiter(this, void 0, void 0, function* () {
        const fields = yield Messaging.getMessageFields(mid, [field]);
        return fields ? fields[field] : null;
    });
    Messaging.getMessageFields = (mid, fields) => __awaiter(this, void 0, void 0, function* () {
        const messages = yield Messaging.getMessagesFields([mid], fields);
        return messages ? messages[0] : null;
    });
    Messaging.setMessageField = (mid, field, content) => __awaiter(this, void 0, void 0, function* () {
        yield db.setObjectField(`message:${mid}`, field, content);
    });
    Messaging.setMessageFields = (mid, data) => __awaiter(this, void 0, void 0, function* () {
        yield db.setObject(`message:${mid}`, data);
    });
    Messaging.getMessagesData = (mids, uid, roomId, isNew) => __awaiter(this, void 0, void 0, function* () {
        let messages = yield Messaging.getMessagesFields(mids, []);
        messages = yield user_1.default.blocks.filter(uid, 'fromuid', messages);
        messages = messages
            .map((msg, idx) => {
            if (msg) {
                msg.messageId = parseInt(mids[idx], 10);
                msg.ip = undefined;
            }
            return msg;
        })
            .filter(Boolean);
        const users = yield user_1.default.getUsersFields(messages.map(msg => msg && msg.fromuid), ['uid', 'username', 'userslug', 'picture', 'status', 'banned']);
        messages.forEach((message, index) => {
            message.fromUser = users[index];
            message.fromUser.banned = !!message.fromUser.banned;
            message.fromUser.deleted = message.fromuid !== message.fromUser.uid && message.fromUser.uid === 0;
            const self = message.fromuid === parseInt(uid, 10);
            message.self = self ? 1 : 0;
            message.newSet = false;
            message.roomId = String(message.roomId || roomId);
            message.deleted = !!message.deleted;
            message.system = !!message.system;
        });
        messages = yield Promise.all(messages.map((message) => __awaiter(this, void 0, void 0, function* () {
            if (message.system) {
                message.content = validator.escape(String(message.content));
                message.cleanedContent = utils.stripHTMLTags(utils.decodeHTMLEntities(message.content));
                return message;
            }
            const result = yield Messaging.parse(message.content, message.fromuid, uid, roomId, isNew);
            message.content = result;
            message.cleanedContent = utils.stripHTMLTags(utils.decodeHTMLEntities(result));
            return message;
        })));
        if (messages.length > 1) {
            // Add a spacer in between messages with time gaps between them
            messages = messages.map((message, index) => {
                // Compare timestamps with the previous message, and check if a spacer needs to be added
                if (index > 0 && message.timestamp > messages[index - 1].timestamp + Messaging.newMessageCutoff) {
                    // If it's been 5 minutes, this is a new set of messages
                    message.newSet = true;
                }
                else if (index > 0 && message.fromuid !== messages[index - 1].fromuid) {
                    // If the previous message was from the other person, this is also a new set
                    message.newSet = true;
                }
                else if (index === 0) {
                    message.newSet = true;
                }
                return message;
            });
        }
        else if (messages.length === 1) {
            // For single messages, we don't know the context, so look up the previous message and compare
            const key = `uid:${uid}:chat:room:${roomId}:mids`;
            const index = yield db.sortedSetRank(key, messages[0].messageId);
            if (index > 0) {
                const mid = yield db.getSortedSetRange(key, index - 1, index - 1);
                const fields = yield Messaging.getMessageFields(mid, ['fromuid', 'timestamp']);
                if ((messages[0].timestamp > fields.timestamp + Messaging.newMessageCutoff) ||
                    (messages[0].fromuid !== fields.fromuid)) {
                    // If it's been 5 minutes, this is a new set of messages
                    messages[0].newSet = true;
                }
            }
            else {
                messages[0].newSet = true;
            }
        }
        else {
            messages = [];
        }
        const data = yield plugins.hooks.fire('filter:messaging.getMessages', {
            messages: messages,
            uid: uid,
            roomId: roomId,
            isNew: isNew,
            mids: mids,
        });
        return data && data.messages;
    });
}
exports.default = default_1;
;
function modifyMessage(message, fields, mid) {
    return __awaiter(this, void 0, void 0, function* () {
        if (message) {
            db.parseIntFields(message, intFields, fields);
            if (message.hasOwnProperty('timestamp')) {
                message.timestampISO = utils.toISOString(message.timestamp);
            }
            if (message.hasOwnProperty('edited')) {
                message.editedISO = utils.toISOString(message.edited);
            }
        }
        const payload = yield plugins.hooks.fire('filter:messaging.getFields', {
            mid: mid,
            message: message,
            fields: fields,
        });
        return payload.message;
    });
}
