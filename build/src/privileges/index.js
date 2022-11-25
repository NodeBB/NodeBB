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
const privileges = {};
privileges.global = require('./global').default;
privileges.admin = require('./admin').default;
privileges.categories = require('./categories').default;
privileges.topics = require('./topics').default;
privileges.posts = require('./posts').default;
privileges.users = require('./users').default;
privileges.init = () => __awaiter(void 0, void 0, void 0, function* () {
    yield privileges.global.init();
    yield privileges.admin.init();
    yield privileges.categories.init();
});
require('../promisify').promisify(privileges);
exports.default = privileges;
