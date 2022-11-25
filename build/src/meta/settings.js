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
const _ = require('lodash');
const database = __importStar(require("../database"));
const db = database;
const plugins = require('../plugins');
const Meta = require('./index');
const pubsub = require('../pubsub').default;
const cache = require('../cache');
const Settings = {};
Settings.get = function (hash) {
    return __awaiter(this, void 0, void 0, function* () {
        const cached = cache.get(`settings:${hash}`);
        if (cached) {
            return _.cloneDeep(cached);
        }
        const [data, sortedLists] = yield Promise.all([
            db.getObject(`settings:${hash}`),
            db.getSetMembers(`settings:${hash}:sorted-lists`),
        ]);
        const values = data || {};
        yield Promise.all(sortedLists.map((list) => __awaiter(this, void 0, void 0, function* () {
            const members = yield db.getSortedSetRange(`settings:${hash}:sorted-list:${list}`, 0, -1);
            const keys = members.map(order => `settings:${hash}:sorted-list:${list}:${order}`);
            values[list] = [];
            const objects = yield db.getObjects(keys);
            objects.forEach((obj) => {
                values[list].push(obj);
            });
        })));
        const result = yield plugins.hooks.fire('filter:settings.get', { plugin: hash, values: values });
        cache.set(`settings:${hash}`, result.values);
        return _.cloneDeep(result.values);
    });
};
Settings.getOne = function (hash, field) {
    return __awaiter(this, void 0, void 0, function* () {
        const data = yield Settings.get(hash);
        return data[field] !== undefined ? data[field] : null;
    });
};
Settings.set = function (hash, values, quiet) {
    return __awaiter(this, void 0, void 0, function* () {
        quiet = quiet || false;
        ({ plugin: hash, settings: values, quiet } = yield plugins.hooks.fire('filter:settings.set', { plugin: hash, settings: values, quiet }));
        const sortedListData = {};
        for (const [key, value] of Object.entries(values)) {
            if (Array.isArray(value) && typeof value[0] !== 'string') {
                sortedListData[key] = value;
                delete values[key];
            }
        }
        const sortedLists = Object.keys(sortedListData);
        if (sortedLists.length) {
            // Remove provided (but empty) sorted lists from the hash set
            yield db.setRemove(`settings:${hash}:sorted-lists`, sortedLists.filter(list => !sortedListData[list].length));
            yield db.setAdd(`settings:${hash}:sorted-lists`, sortedLists);
            yield Promise.all(sortedLists.map((list) => __awaiter(this, void 0, void 0, function* () {
                const numItems = yield db.sortedSetCard(`settings:${hash}:sorted-list:${list}`);
                const deleteKeys = [`settings:${hash}:sorted-list:${list}`];
                for (let x = 0; x < numItems; x++) {
                    deleteKeys.push(`settings:${hash}:sorted-list:${list}:${x}`);
                }
                yield db.deleteAll(deleteKeys);
            })));
            const sortedSetData = [];
            const objectData = [];
            sortedLists.forEach((list) => {
                const arr = sortedListData[list];
                arr.forEach((data, order) => {
                    sortedSetData.push([`settings:${hash}:sorted-list:${list}`, order, order]);
                    objectData.push([`settings:${hash}:sorted-list:${list}:${order}`, data]);
                });
            });
            yield Promise.all([
                db.sortedSetAddBulk(sortedSetData),
                db.setObjectBulk(objectData),
            ]);
        }
        if (Object.keys(values).length) {
            yield db.setObject(`settings:${hash}`, values);
        }
        cache.del(`settings:${hash}`);
        plugins.hooks.fire('action:settings.set', {
            plugin: hash,
            settings: Object.assign(Object.assign({}, values), sortedListData),
            quiet,
        });
        pubsub.publish(`action:settings.set.${hash}`, values);
        if (!Meta.reloadRequired && !quiet) {
            Meta.reloadRequired = true;
        }
    });
};
Settings.setOne = function (hash, field, value) {
    return __awaiter(this, void 0, void 0, function* () {
        const data = {};
        data[field] = value;
        yield Settings.set(hash, data);
    });
};
Settings.setOnEmpty = function (hash, values) {
    return __awaiter(this, void 0, void 0, function* () {
        const settings = (yield Settings.get(hash)) || {};
        const empty = {};
        Object.keys(values).forEach((key) => {
            if (!settings.hasOwnProperty(key)) {
                empty[key] = values[key];
            }
        });
        if (Object.keys(empty).length) {
            yield Settings.set(hash, empty);
        }
    });
};
exports.default = Settings;
