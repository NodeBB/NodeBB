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
const database_1 = __importDefault(require("../../database"));
exports.default = {
    name: 'Convert old notification digest settings',
    timestamp: Date.UTC(2017, 10, 15),
    method: function () {
        return __awaiter(this, void 0, void 0, function* () {
            const { progress } = this;
            yield batch.processSortedSet('users:joindate', (uids) => __awaiter(this, void 0, void 0, function* () {
                yield Promise.all(uids.map((uid) => __awaiter(this, void 0, void 0, function* () {
                    progress.incr();
                    const userSettings = yield database_1.default.getObjectFields(`user:${uid}:settings`, ['sendChatNotifications', 'sendPostNotifications']);
                    if (userSettings) {
                        if (parseInt(userSettings.sendChatNotifications, 10) === 1) {
                            yield database_1.default.setObjectField(`user:${uid}:settings`, 'notificationType_new-chat', 'notificationemail');
                        }
                        if (parseInt(userSettings.sendPostNotifications, 10) === 1) {
                            yield database_1.default.setObjectField(`user:${uid}:settings`, 'notificationType_new-reply', 'notificationemail');
                        }
                    }
                    yield database_1.default.deleteObjectFields(`user:${uid}:settings`, ['sendChatNotifications', 'sendPostNotifications']);
                })));
            }), {
                progress: progress,
                batch: 500,
            });
        });
    },
};
