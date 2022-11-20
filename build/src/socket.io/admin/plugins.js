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
const nconf_1 = __importDefault(require("nconf"));
const plugins = require('../../plugins');
const events = require('../../events');
const database_1 = __importDefault(require("../../database"));
const Plugins = {};
Plugins.toggleActive = function (socket, plugin_id) {
    return __awaiter(this, void 0, void 0, function* () {
        require('../../posts/cache').reset();
        const data = yield plugins.toggleActive(plugin_id);
        yield events.log({
            type: `plugin-${data.active ? 'activate' : 'deactivate'}`,
            text: plugin_id,
            uid: socket.uid,
        });
        return data;
    });
};
Plugins.toggleInstall = function (socket, data) {
    return __awaiter(this, void 0, void 0, function* () {
        require('../../posts/cache').reset();
        yield plugins.checkWhitelist(data.id, data.version);
        const pluginData = yield plugins.toggleInstall(data.id, data.version);
        yield events.log({
            type: `plugin-${pluginData.installed ? 'install' : 'uninstall'}`,
            text: data.id,
            version: data.version,
            uid: socket.uid,
        });
        return pluginData;
    });
};
Plugins.getActive = function () {
    return __awaiter(this, void 0, void 0, function* () {
        return yield plugins.getActive();
    });
};
Plugins.orderActivePlugins = function (socket, data) {
    return __awaiter(this, void 0, void 0, function* () {
        if (nconf_1.default.get('plugins:active')) {
            throw new Error('[[error:plugins-set-in-configuration]]');
        }
        data = data.filter(plugin => plugin && plugin.name);
        yield Promise.all(data.map(plugin => database_1.default.sortedSetAdd('plugins:active', plugin.order || 0, plugin.name)));
    });
};
Plugins.upgrade = function (socket, data) {
    return __awaiter(this, void 0, void 0, function* () {
        return yield plugins.upgrade(data.id, data.version);
    });
};
exports.default = Plugins;
