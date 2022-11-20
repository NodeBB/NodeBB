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
const SocketCache = {};
const database_1 = __importDefault(require("../../database"));
const plugins = require('../../plugins');
SocketCache.clear = function (socket, data) {
    return __awaiter(this, void 0, void 0, function* () {
        let caches = {
            post: require('../../posts/cache'),
            object: database_1.default.objectCache,
            group: require('../../groups').cache,
            local: require('../../cache'),
        };
        caches = yield plugins.hooks.fire('filter:admin.cache.get', caches);
        if (!caches[data.name]) {
            return;
        }
        caches[data.name].reset();
    });
};
SocketCache.toggle = function (socket, data) {
    return __awaiter(this, void 0, void 0, function* () {
        let caches = {
            post: require('../../posts/cache'),
            object: database_1.default.objectCache,
            group: require('../../groups').cache,
            local: require('../../cache'),
        };
        caches = yield plugins.hooks.fire('filter:admin.cache.get', caches);
        if (!caches[data.name]) {
            return;
        }
        caches[data.name].enabled = data.enabled;
    });
};
