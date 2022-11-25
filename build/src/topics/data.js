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
Object.defineProperty(exports, "__esModule", { value: true });
const validator = require('validator');
const database = __importStar(require("../database"));
const db = database;
const categories = require('../categories');
const utils = require('../utils');
const translator = require('../translator');
const plugins = require('../plugins');
const intFields = [
    'tid', 'cid', 'uid', 'mainPid', 'postcount',
    'viewcount', 'postercount', 'deleted', 'locked', 'pinned',
    'pinExpiry', 'timestamp', 'upvotes', 'downvotes', 'lastposttime',
    'deleterUid',
];
function default_1(Topics) {
    Topics.getTopicsFields = function (tids, fields) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!Array.isArray(tids) || !tids.length) {
                return [];
            }
            // "scheduled" is derived from "timestamp"
            if (fields.includes('scheduled') && !fields.includes('timestamp')) {
                fields.push('timestamp');
            }
            const keys = tids.map(tid => `topic:${tid}`);
            const topics = yield db.getObjects(keys, fields);
            const result = yield plugins.hooks.fire('filter:topic.getFields', {
                tids: tids,
                topics: topics,
                fields: fields,
                keys: keys,
            });
            result.topics.forEach((topic) => modifyTopic(topic, fields));
            return result.topics;
        });
    };
    Topics.getTopicField = function (tid, field) {
        return __awaiter(this, void 0, void 0, function* () {
            const topic = yield Topics.getTopicFields(tid, [field]);
            return topic ? topic[field] : null;
        });
    };
    Topics.getTopicFields = function (tid, fields) {
        return __awaiter(this, void 0, void 0, function* () {
            const topics = yield Topics.getTopicsFields([tid], fields);
            return topics ? topics[0] : null;
        });
    };
    Topics.getTopicData = function (tid) {
        return __awaiter(this, void 0, void 0, function* () {
            const topics = yield Topics.getTopicsFields([tid], []);
            return topics && topics.length ? topics[0] : null;
        });
    };
    Topics.getTopicsData = function (tids) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield Topics.getTopicsFields(tids, []);
        });
    };
    Topics.getCategoryData = function (tid) {
        return __awaiter(this, void 0, void 0, function* () {
            const cid = yield Topics.getTopicField(tid, 'cid');
            return yield categories.getCategoryData(cid);
        });
    };
    Topics.setTopicField = function (tid, field, value) {
        return __awaiter(this, void 0, void 0, function* () {
            yield db.setObjectField(`topic:${tid}`, field, value);
        });
    };
    Topics.setTopicFields = function (tid, data) {
        return __awaiter(this, void 0, void 0, function* () {
            yield db.setObject(`topic:${tid}`, data);
        });
    };
    Topics.deleteTopicField = function (tid, field) {
        return __awaiter(this, void 0, void 0, function* () {
            yield db.deleteObjectField(`topic:${tid}`, field);
        });
    };
    Topics.deleteTopicFields = function (tid, fields) {
        return __awaiter(this, void 0, void 0, function* () {
            yield db.deleteObjectFields(`topic:${tid}`, fields);
        });
    };
}
exports.default = default_1;
;
function escapeTitle(topicData) {
    if (topicData) {
        if (topicData.title) {
            topicData.title = translator.escape(validator.escape(topicData.title));
        }
        if (topicData.titleRaw) {
            topicData.titleRaw = translator.escape(topicData.titleRaw);
        }
    }
}
function modifyTopic(topic, fields) {
    if (!topic) {
        return;
    }
    db.parseIntFields(topic, intFields, fields);
    if (topic.hasOwnProperty('title')) {
        topic.titleRaw = topic.title;
        topic.title = String(topic.title);
    }
    escapeTitle(topic);
    if (topic.hasOwnProperty('timestamp')) {
        topic.timestampISO = utils.toISOString(topic.timestamp);
        if (!fields.length || fields.includes('scheduled')) {
            topic.scheduled = topic.timestamp > Date.now();
        }
    }
    if (topic.hasOwnProperty('lastposttime')) {
        topic.lastposttimeISO = utils.toISOString(topic.lastposttime);
    }
    if (topic.hasOwnProperty('pinExpiry')) {
        topic.pinExpiryISO = utils.toISOString(topic.pinExpiry);
    }
    if (topic.hasOwnProperty('upvotes') && topic.hasOwnProperty('downvotes')) {
        topic.votes = topic.upvotes - topic.downvotes;
    }
    if (fields.includes('teaserPid') || !fields.length) {
        topic.teaserPid = topic.teaserPid || null;
    }
    if (fields.includes('tags') || !fields.length) {
        const tags = String(topic.tags || '');
        topic.tags = tags.split(',').filter(Boolean).map((tag) => {
            const escaped = validator.escape(String(tag));
            return {
                value: tag,
                valueEscaped: escaped,
                valueEncoded: encodeURIComponent(escaped),
                class: escaped.replace(/\s/g, '-'),
            };
        });
    }
}
