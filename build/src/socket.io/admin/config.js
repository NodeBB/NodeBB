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
const meta_1 = __importDefault(require("../../meta"));
const plugins = require('../../plugins');
const logger = require('../../logger');
const events = require('../../events');
const index = require('../index');
const Config = {};
Config.set = function (socket, data) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!data) {
            throw new Error('[[error:invalid-data]]');
        }
        const _data = {};
        _data[data.key] = data.value;
        yield Config.setMultiple(socket, _data);
    });
};
Config.setMultiple = function (socket, data) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!data) {
            throw new Error('[[error:invalid-data]]');
        }
        const changes = {};
        const newData = meta_1.default.configs.serialize(data);
        const oldData = meta_1.default.configs.serialize(meta_1.default.config);
        Object.keys(newData).forEach((key) => {
            if (newData[key] !== oldData[key]) {
                changes[key] = newData[key];
                changes[`${key}_old`] = meta_1.default.config[key];
            }
        });
        yield meta_1.default.configs.setMultiple(data);
        for (const [key, value] of Object.entries(data)) {
            const setting = { key, value };
            plugins.hooks.fire('action:config.set', setting);
            logger.monitorConfig({ io: index.server }, setting);
        }
        if (Object.keys(changes).length) {
            changes.type = 'config-change';
            changes.uid = socket.uid;
            changes.ip = socket.ip;
            yield events.log(changes);
        }
    });
};
Config.remove = function (socket, key) {
    return __awaiter(this, void 0, void 0, function* () {
        yield meta_1.default.configs.remove(key);
    });
};
