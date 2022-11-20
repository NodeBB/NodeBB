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
    name: 'Favourites to Bookmarks',
    timestamp: Date.UTC(2016, 9, 8),
    method: function () {
        return __awaiter(this, void 0, void 0, function* () {
            const { progress } = this;
            const batch = require('../../batch');
            function upgradePosts() {
                return __awaiter(this, void 0, void 0, function* () {
                    yield batch.processSortedSet('posts:pid', (ids) => __awaiter(this, void 0, void 0, function* () {
                        yield Promise.all(ids.map((id) => __awaiter(this, void 0, void 0, function* () {
                            progress.incr();
                            yield database_1.default.rename(`pid:${id}:users_favourited`, `pid:${id}:users_bookmarked`);
                            const reputation = yield database_1.default.getObjectField(`post:${id}`, 'reputation');
                            if (parseInt(reputation, 10)) {
                                yield database_1.default.setObjectField(`post:${id}`, 'bookmarks', reputation);
                            }
                            yield database_1.default.deleteObjectField(`post:${id}`, 'reputation');
                        })));
                    }), {
                        progress: progress,
                    });
                });
            }
            function upgradeUsers() {
                return __awaiter(this, void 0, void 0, function* () {
                    yield batch.processSortedSet('users:joindate', (ids) => __awaiter(this, void 0, void 0, function* () {
                        yield Promise.all(ids.map((id) => __awaiter(this, void 0, void 0, function* () {
                            yield database_1.default.rename(`uid:${id}:favourites`, `uid:${id}:bookmarks`);
                        })));
                    }), {});
                });
            }
            yield upgradePosts();
            yield upgradeUsers();
        });
    },
};
