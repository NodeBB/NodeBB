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
    name: 'Flatten navigation data',
    timestamp: Date.UTC(2018, 1, 17),
    method: function () {
        return __awaiter(this, void 0, void 0, function* () {
            const data = yield database_1.default.getSortedSetRangeWithScores('navigation:enabled', 0, -1);
            const order = [];
            const items = [];
            data.forEach((item) => {
                let navItem = JSON.parse(item.value);
                const keys = Object.keys(navItem);
                if (keys.length && parseInt(keys[0], 10) >= 0) {
                    navItem = navItem[keys[0]];
                }
                order.push(item.score);
                items.push(JSON.stringify(navItem));
            });
            yield database_1.default.delete('navigation:enabled');
            yield database_1.default.sortedSetAdd('navigation:enabled', order, items);
        });
    },
};
