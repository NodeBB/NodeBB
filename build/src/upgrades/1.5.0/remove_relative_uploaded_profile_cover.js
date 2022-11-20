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
    name: 'Remove relative_path from uploaded profile cover urls',
    timestamp: Date.UTC(2017, 3, 26),
    method: function () {
        return __awaiter(this, void 0, void 0, function* () {
            const { progress } = this;
            yield batch.processSortedSet('users:joindate', (ids) => __awaiter(this, void 0, void 0, function* () {
                yield Promise.all(ids.map((uid) => __awaiter(this, void 0, void 0, function* () {
                    const url = yield database_1.default.getObjectField(`user:${uid}`, 'cover:url');
                    progress.incr();
                    if (url) {
                        const newUrl = url.replace(/^.*?\/uploads\//, '/assets/uploads/');
                        yield database_1.default.setObjectField(`user:${uid}`, 'cover:url', newUrl);
                    }
                })));
            }), {
                progress: this.progress,
            });
        });
    },
};
