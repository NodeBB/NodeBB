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
const batch = require('../../batch');
const posts = require('../../posts');
const database_1 = __importDefault(require("../../database"));
exports.default = {
    name: 'Calculate image sizes of all uploaded images',
    timestamp: Date.UTC(2019, 2, 16),
    method: function () {
        return __awaiter(this, void 0, void 0, function* () {
            const { progress } = this;
            yield batch.processSortedSet('posts:pid', (pids) => __awaiter(this, void 0, void 0, function* () {
                const keys = pids.map(p => `post:${p}:uploads`);
                const uploads = yield database_1.default.getSortedSetRange(keys, 0, -1);
                yield posts.uploads.saveSize(uploads);
                progress.incr(pids.length);
            }), {
                batch: 100,
                progress: progress,
            });
        });
    },
};
