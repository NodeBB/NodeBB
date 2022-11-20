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
const privileges = require('../../privileges');
exports.default = {
    name: 'Add "schedule" to default privileges of admins and gmods for existing categories',
    timestamp: Date.UTC(2021, 2, 11),
    method: () => __awaiter(void 0, void 0, void 0, function* () {
        const privilegeToGive = ['groups:topics:schedule'];
        const cids = yield database_1.default.getSortedSetRevRange('categories:cid', 0, -1);
        for (const cid of cids) {
            /* eslint-disable no-await-in-loop */
            yield privileges.categories.give(privilegeToGive, cid, ['administrators', 'Global Moderators']);
        }
    }),
};
