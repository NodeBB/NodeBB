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
const database_1 = __importDefault(require("../../database"));
exports.default = {
    name: 'Navigation item visibility groups',
    timestamp: Date.UTC(2018, 10, 10),
    method: function () {
        return __awaiter(this, void 0, void 0, function* () {
            const data = yield navigationAdminGet();
            data.forEach((navItem) => {
                if (navItem && navItem.properties) {
                    navItem.groups = [];
                    if (navItem.properties.adminOnly) {
                        navItem.groups.push('administrators');
                    }
                    else if (navItem.properties.globalMod) {
                        navItem.groups.push('Global Moderators');
                    }
                    if (navItem.properties.loggedIn) {
                        navItem.groups.push('registered-users');
                    }
                    else if (navItem.properties.guestOnly) {
                        navItem.groups.push('guests');
                    }
                }
            });
            yield navigationAdminSave(data);
        });
    },
};
// use navigation.get/save as it was in 1.11.0 so upgrade script doesn't crash on latest nbb
// see https://github.com/NodeBB/NodeBB/pull/11013
function navigationAdminGet() {
    return __awaiter(this, void 0, void 0, function* () {
        const data = yield database_1.default.getSortedSetRange('navigation:enabled', 0, -1);
        return data.filter(Boolean).map((item) => {
            item = JSON.parse(item);
            item.groups = item.groups || [];
            if (item.groups && !Array.isArray(item.groups)) {
                item.groups = [item.groups];
            }
            return item;
        });
    });
}
function navigationAdminSave(data) {
    return __awaiter(this, void 0, void 0, function* () {
        const translator = require('../../translator');
        const order = Object.keys(data);
        const items = data.map((item, index) => {
            Object.keys(item).forEach((key) => {
                if (item.hasOwnProperty(key) && typeof item[key] === 'string' && (key === 'title' || key === 'text')) {
                    item[key] = translator.escape(item[key]);
                }
            });
            item.order = order[index];
            return JSON.stringify(item);
        });
        yield database_1.default.delete('navigation:enabled');
        yield database_1.default.sortedSetAdd('navigation:enabled', order, items);
    });
}
