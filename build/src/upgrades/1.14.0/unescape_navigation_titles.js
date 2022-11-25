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
    name: 'Unescape navigation titles',
    timestamp: Date.UTC(2020, 5, 26),
    method: function () {
        return __awaiter(this, void 0, void 0, function* () {
            const data = yield db.getSortedSetRangeWithScores('navigation:enabled', 0, -1);
            const translator = require('../../translator');
            const order = [];
            const items = [];
            data.forEach((item) => {
                const navItem = JSON.parse(item.value);
                if (navItem.hasOwnProperty('title')) {
                    navItem.title = translator.unescape(navItem.title);
                    navItem.title = navItem.title.replace(/&#x5C;/g, '');
                }
                if (navItem.hasOwnProperty('text')) {
                    navItem.text = translator.unescape(navItem.text);
                    navItem.text = navItem.text.replace(/&#x5C;/g, '');
                }
                if (navItem.hasOwnProperty('route')) {
                    navItem.route = navItem.route.replace('&#x2F;', '/');
                }
                order.push(item.score);
                items.push(JSON.stringify(navItem));
            });
            yield db.delete('navigation:enabled');
            yield db.sortedSetAdd('navigation:enabled', order, items);
        });
    },
};
