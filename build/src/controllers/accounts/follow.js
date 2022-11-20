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
const user_1 = __importDefault(require("../../user"));
const helpers_1 = __importDefault(require("../helpers"));
const accountHelpers = require('./helpers').defualt;
const pagination = require('../../pagination');
const followController = {};
followController.getFollowing = function (req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        yield getFollow('account/following', 'following', req, res, next);
    });
};
followController.getFollowers = function (req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        yield getFollow('account/followers', 'followers', req, res, next);
    });
};
function getFollow(tpl, name, req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        const userData = yield accountHelpers.getUserDataByUserSlug(req.params.userslug, req.uid, req.query);
        if (!userData) {
            return next();
        }
        const page = parseInt(req.query.page, 10) || 1;
        const resultsPerPage = 50;
        const start = Math.max(0, page - 1) * resultsPerPage;
        const stop = start + resultsPerPage - 1;
        userData.title = `[[pages:${tpl}, ${userData.username}]]`;
        const method = name === 'following' ? 'getFollowing' : 'getFollowers';
        userData.users = yield user_1.default[method](userData.uid, start, stop);
        const count = name === 'following' ? userData.followingCount : userData.followerCount;
        const pageCount = Math.ceil(count / resultsPerPage);
        userData.pagination = pagination.create(page, pageCount);
        userData.breadcrumbs = helpers_1.default.buildBreadcrumbs([{ text: userData.username, url: `/user/${userData.userslug}` }, { text: `[[user:${name}]]` }]);
        res.render(tpl, userData);
    });
}
