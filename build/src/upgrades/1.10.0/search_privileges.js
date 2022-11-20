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
exports.default = {
    name: 'Give global search privileges',
    timestamp: Date.UTC(2018, 4, 28),
    method: function () {
        return __awaiter(this, void 0, void 0, function* () {
            const privileges = require('../../privileges');
            const allowGuestSearching = parseInt(meta_1.default.config.allowGuestSearching, 10) === 1;
            const allowGuestUserSearching = parseInt(meta_1.default.config.allowGuestUserSearching, 10) === 1;
            yield privileges.global.give(['groups:search:content', 'groups:search:users', 'groups:search:tags'], 'registered-users');
            const guestPrivs = [];
            if (allowGuestSearching) {
                guestPrivs.push('groups:search:content');
            }
            if (allowGuestUserSearching) {
                guestPrivs.push('groups:search:users');
            }
            guestPrivs.push('groups:search:tags');
            yield privileges.global.give(guestPrivs, 'guests');
        });
    },
};
