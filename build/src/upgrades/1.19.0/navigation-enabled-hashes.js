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
    name: 'Upgrade navigation items to hashes',
    timestamp: Date.UTC(2021, 11, 13),
    method: function () {
        return __awaiter(this, void 0, void 0, function* () {
            const data = yield database_1.default.getSortedSetRangeWithScores('navigation:enabled', 0, -1);
            const order = [];
            const bulkSet = [];
            data.forEach((item) => {
                const navItem = JSON.parse(item.value);
                if (navItem.hasOwnProperty('properties') && navItem.properties) {
                    if (navItem.properties.hasOwnProperty('targetBlank')) {
                        navItem.targetBlank = navItem.properties.targetBlank;
                    }
                    delete navItem.properties;
                }
                if (navItem.hasOwnProperty('groups') && (Array.isArray(navItem.groups) || typeof navItem.groups === 'string')) {
                    navItem.groups = JSON.stringify(navItem.groups);
                }
                bulkSet.push([`navigation:enabled:${item.score}`, navItem]);
                order.push(item.score);
            });
            yield database_1.default.setObjectBulk(bulkSet);
            yield database_1.default.delete('navigation:enabled');
            yield database_1.default.sortedSetAdd('navigation:enabled', order, order);
        });
    },
};
