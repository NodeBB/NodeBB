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
const user_1 = __importDefault(require("../../user"));
exports.default = {
    name: 'Create fullname search set',
    timestamp: Date.UTC(2020, 8, 11),
    method: function () {
        return __awaiter(this, void 0, void 0, function* () {
            const { progress } = this;
            yield batch.processSortedSet('users:joindate', (uids) => __awaiter(this, void 0, void 0, function* () {
                progress.incr(uids.length);
                const userData = yield user_1.default.getUsersFields(uids, ['uid', 'fullname']);
                const bulkAdd = userData
                    .filter(u => u.uid && u.fullname)
                    .map(u => ['fullname:sorted', 0, `${String(u.fullname).slice(0, 255).toLowerCase()}:${u.uid}`]);
                yield database_1.default.sortedSetAddBulk(bulkAdd);
            }), {
                batch: 500,
                progress: this.progress,
            });
        });
    },
};
