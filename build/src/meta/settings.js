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
const _ = require('lodash');
const database_1 = __importDefault(require("../database"));
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
            database_1.default.getObject(`settings:${hash}`),
            database_1.default.getSetMembers(`settings:${hash}:sorted-lists`),
        ]);
        const values = data || {};
        yield Promise.all(sortedLists.map((list) => __awaiter(this, void 0, void 0, function* () {
            const members = yield database_1.default.getSortedSetRange(`settings:${hash}:sorted-list:${list}`, 0, -1);
            const keys = members.map(order => `settings:${hash}:sorted-list:${list}:${order}`);
            values[list] = [];
            const objects = yield database_1.default.getObjects(keys);
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
            yield database_1.default.setRemove(`settings:${hash}:sorted-lists`, sortedLists.filter(list => !sortedListData[list].length));
            yield database_1.default.setAdd(`settings:${hash}:sorted-lists`, sortedLists);
            yield Promise.all(sortedLists.map((list) => __awaiter(this, void 0, void 0, function* () {
                const numItems = yield database_1.default.sortedSetCard(`settings:${hash}:sorted-list:${list}`);
                const deleteKeys = [`settings:${hash}:sorted-list:${list}`];
                for (let x = 0; x < numItems; x++) {
                    deleteKeys.push(`settings:${hash}:sorted-list:${list}:${x}`);
                }
                yield database_1.default.deleteAll(deleteKeys);
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
                database_1.default.sortedSetAddBulk(sortedSetData),
                database_1.default.setObjectBulk(objectData),
            ]);
        }
        if (Object.keys(values).length) {
            yield database_1.default.setObject(`settings:${hash}`, values);
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
