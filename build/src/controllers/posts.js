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
const querystring = require('querystring');
const posts_1 = __importDefault(require("../posts"));
const privileges = require('../privileges');
const helpers = require('./helpers').defualt;
const postsController = {};
postsController.redirectToPost = function (req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        const pid = parseInt(req.params.pid, 10);
        if (!pid) {
            return next();
        }
        const [canRead, path] = yield Promise.all([
            privileges.posts.can('topics:read', pid, req.uid),
            posts_1.default.generatePostPath(pid, req.uid),
        ]);
        if (!path) {
            return next();
        }
        if (!canRead) {
            return helpers.notAllowed(req, res);
        }
        const qs = querystring.stringify(req.query);
        helpers.redirect(res, qs ? `${path}?${qs}` : path);
    });
};
postsController.getRecentPosts = function (req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const page = parseInt(req.query.page, 10) || 1;
        const postsPerPage = 20;
        const start = Math.max(0, (page - 1) * postsPerPage);
        const stop = start + postsPerPage - 1;
        const data = yield posts_1.default.getRecentPosts(req.uid, start, stop, req.params.term);
        res.json(data);
    });
};
