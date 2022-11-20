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
const user_1 = __importDefault(require("../../user"));
const meta_1 = __importDefault(require("../../meta"));
exports.default = {
    name: 'Update global and user language keys',
    timestamp: Date.UTC(2016, 10, 22),
    method: function () {
        return __awaiter(this, void 0, void 0, function* () {
            const { progress } = this;
            const batch = require('../../batch');
            const defaultLang = yield meta_1.default.configs.get('defaultLang');
            if (defaultLang) {
                const newLanguage = defaultLang.replace('_', '-').replace('@', '-x-');
                if (newLanguage !== defaultLang) {
                    yield meta_1.default.configs.set('defaultLang', newLanguage);
                }
            }
            yield batch.processSortedSet('users:joindate', (ids) => __awaiter(this, void 0, void 0, function* () {
                yield Promise.all(ids.map((uid) => __awaiter(this, void 0, void 0, function* () {
                    progress.incr();
                    const language = yield database_1.default.getObjectField(`user:${uid}:settings`, 'userLang');
                    if (language) {
                        const newLanguage = language.replace('_', '-').replace('@', '-x-');
                        if (newLanguage !== language) {
                            yield user_1.default.setSetting(uid, 'userLang', newLanguage);
                        }
                    }
                })));
            }), {
                progress: progress,
            });
        });
    },
};
