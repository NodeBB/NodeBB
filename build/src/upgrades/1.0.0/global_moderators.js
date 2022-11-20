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
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    name: 'Creating Global moderators group',
    timestamp: Date.UTC(2016, 0, 23),
    method: function () {
        return __awaiter(this, void 0, void 0, function* () {
            const groups = require('../../groups');
            const exists = yield groups.exists('Global Moderators');
            if (exists) {
                return;
            }
            yield groups.create({
                name: 'Global Moderators',
                userTitle: 'Global Moderator',
                description: 'Forum wide moderators',
                hidden: 0,
                private: 1,
                disableJoinRequests: 1,
            });
            yield groups.show('Global Moderators');
        });
    },
};
