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
    name: 'Add default settings for notification delivery types',
    timestamp: Date.UTC(2018, 1, 14),
    method: function () {
        return __awaiter(this, void 0, void 0, function* () {
            const config = yield database_1.default.getObject('config');
            const postNotifications = parseInt(config.sendPostNotifications, 10) === 1 ? 'notification' : 'none';
            const chatNotifications = parseInt(config.sendChatNotifications, 10) === 1 ? 'notification' : 'none';
            yield database_1.default.setObject('config', {
                notificationType_upvote: config.notificationType_upvote || 'notification',
                'notificationType_new-topic': config['notificationType_new-topic'] || 'notification',
                'notificationType_new-reply': config['notificationType_new-reply'] || postNotifications,
                notificationType_follow: config.notificationType_follow || 'notification',
                'notificationType_new-chat': config['notificationType_new-chat'] || chatNotifications,
                'notificationType_group-invite': config['notificationType_group-invite'] || 'notification',
            });
        });
    },
};
