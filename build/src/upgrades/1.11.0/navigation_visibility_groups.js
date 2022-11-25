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
const database = __importStar(require("../../database"));
const db = database;
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
        const data = yield db.getSortedSetRange('navigation:enabled', 0, -1);
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
        yield db.delete('navigation:enabled');
        yield db.sortedSetAdd('navigation:enabled', order, items);
    });
}
