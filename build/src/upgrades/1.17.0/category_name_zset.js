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
const batch = require('../../batch');
exports.default = {
    name: 'Create category name sorted set',
    timestamp: Date.UTC(2021, 0, 27),
    method: function () {
        return __awaiter(this, void 0, void 0, function* () {
            const { progress } = this;
            yield batch.processSortedSet('categories:cid', (cids) => __awaiter(this, void 0, void 0, function* () {
                const keys = cids.map((cid) => `category:${cid}`);
                let categoryData = yield database_1.default.getObjectsFields(keys, ['cid', 'name']);
                categoryData = categoryData.filter(c => c.cid && c.name);
                const bulkAdd = categoryData.map(cat => [
                    'categories:name',
                    0,
                    `${String(cat.name).slice(0, 200).toLowerCase()}:${cat.cid}`,
                ]);
                yield database_1.default.sortedSetAddBulk(bulkAdd);
                progress.incr(cids.length);
            }), {
                batch: 500,
                progress: progress,
            });
        });
    },
};
