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
const meta_1 = __importDefault(require("../../meta"));
const userDigest = require('../../user/digest');
const userEmail = require('../../user/email');
const notifications = require('../../notifications');
const emailer = require('../../emailer');
const utils = require('../../utils');
const Email = {};
Email.test = function (socket, data) {
    return __awaiter(this, void 0, void 0, function* () {
        const payload = Object.assign(Object.assign({}, (data.payload || {})), { subject: '[[email:test-email.subject]]' });
        switch (data.template) {
            case 'digest':
                yield userDigest.execute({
                    interval: 'month',
                    subscribers: [socket.uid],
                });
                break;
            case 'banned':
                Object.assign(payload, {
                    username: 'test-user',
                    until: utils.toISOString(Date.now()),
                    reason: 'Test Reason',
                });
                yield emailer.send(data.template, socket.uid, payload);
                break;
            case 'verify-email':
            case 'welcome':
                yield userEmail.sendValidationEmail(socket.uid, {
                    force: 1,
                    template: data.template,
                    subject: data.template === 'welcome' ? `[[email:welcome-to, ${meta_1.default.config.title || meta_1.default.config.browserTitle || 'NodeBB'}]]` : undefined,
                });
                break;
            case 'notification': {
                const notification = yield notifications.create({
                    type: 'test',
                    bodyShort: '[[email:notif.test.short]]',
                    bodyLong: '[[email:notif.test.long]]',
                    nid: `uid:${socket.uid}:test`,
                    path: '/',
                    from: socket.uid,
                });
                yield emailer.send('notification', socket.uid, {
                    path: notification.path,
                    subject: utils.stripHTMLTags(notification.subject || '[[notifications:new_notification]]'),
                    intro: utils.stripHTMLTags(notification.bodyShort),
                    body: notification.bodyLong || '',
                    notification,
                    showUnsubscribe: true,
                });
                break;
            }
            default:
                yield emailer.send(data.template, socket.uid, payload);
                break;
        }
    });
};
