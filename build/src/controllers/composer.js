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
exports.post = exports.get = void 0;
const nconf_1 = __importDefault(require("nconf"));
const user_1 = __importDefault(require("../user"));
const plugins = require('../plugins');
const topics = require('../topics');
const posts = require('../posts');
const helpers = require('./helpers').defualt;
const get = function (req, res, callback) {
    return __awaiter(this, void 0, void 0, function* () {
        res.locals.metaTags = Object.assign(Object.assign({}, res.locals.metaTags), { name: 'robots', content: 'noindex' });
        const data = yield plugins.hooks.fire('filter:composer.build', {
            req: req,
            res: res,
            next: callback,
            templateData: {},
        });
        if (res.headersSent) {
            return;
        }
        if (!data || !data.templateData) {
            return callback(new Error('[[error:invalid-data]]'));
        }
        if (data.templateData.disabled) {
            res.render('', {
                title: '[[modules:composer.compose]]',
            });
        }
        else {
            data.templateData.title = '[[modules:composer.compose]]';
            res.render('compose', data.templateData);
        }
    });
};
exports.get = get;
const post = function (req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const { body } = req;
        const data = {
            uid: req.uid,
            req: req,
            timestamp: Date.now(),
            content: body.content,
            fromQueue: false,
        };
        req.body.noscript = 'true';
        if (!data.content) {
            return helpers.noScriptErrors(req, res, '[[error:invalid-data]]', 400);
        }
        function queueOrPost(postFn, data) {
            return __awaiter(this, void 0, void 0, function* () {
                const shouldQueue = yield posts.shouldQueue(req.uid, data);
                if (shouldQueue) {
                    delete data.req;
                    return yield posts.addToQueue(data);
                }
                return yield postFn(data);
            });
        }
        try {
            let result;
            if (body.tid) {
                data.tid = body.tid;
                result = yield queueOrPost(topics.reply, data);
            }
            else if (body.cid) {
                data.cid = body.cid;
                data.title = body.title;
                data.tags = [];
                data.thumb = '';
                result = yield queueOrPost(topics.post, data);
            }
            else {
                throw new Error('[[error:invalid-data]]');
            }
            if (result.queued) {
                return res.redirect(`${nconf_1.default.get('relative_path') || '/'}?noScriptMessage=[[success:post-queued]]`);
            }
            const uid = result.uid ? result.uid : result.topicData.uid;
            user_1.default.updateOnlineUsers(uid);
            const path = result.pid ? `/post/${result.pid}` : `/topic/${result.topicData.slug}`;
            res.redirect(nconf_1.default.get('relative_path') + path);
        }
        catch (err) {
            helpers.noScriptErrors(req, res, err.message, 400);
        }
    });
};
exports.post = post;
