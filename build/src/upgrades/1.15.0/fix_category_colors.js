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
    name: 'Fix category colors that are 3 digit hex colors',
    timestamp: Date.UTC(2020, 9, 11),
    method: () => __awaiter(void 0, void 0, void 0, function* () {
        const batch = require('../../batch');
        yield batch.processSortedSet('categories:cid', (cids) => __awaiter(void 0, void 0, void 0, function* () {
            let categoryData = yield database_1.default.getObjects(cids.map(c => `category:${c}`));
            categoryData = categoryData.filter(c => c && (c.color === '#fff' || c.color === '#333' || String(c.color).length !== 7));
            if (categoryData.length) {
                yield Promise.all(categoryData.map((data) => __awaiter(void 0, void 0, void 0, function* () {
                    const color = `#${new Array(6).fill((data.color && data.color[1]) || 'f').join('')}`;
                    yield database_1.default.setObjectField(`category:${data.cid}`, 'color', color);
                })));
            }
        }), { batch: 500 });
    }),
};
