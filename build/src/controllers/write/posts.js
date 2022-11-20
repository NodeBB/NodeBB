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
const posts = require('../../posts');
const privileges = require('../../privileges');
const api = require('../../api');
const helpers_1 = __importDefault(require("../helpers"));
const apiHelpers = require('../../api/helpers');
const Posts = {};
Posts.get = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    helpers_1.default.formatApiResponse(200, res, yield api.posts.get(req, { pid: req.params.pid }));
});
Posts.edit = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const editResult = yield api.posts.edit(req, Object.assign(Object.assign({}, req.body), { pid: req.params.pid, uid: req.uid, req: apiHelpers.buildReqObject(req) }));
    helpers_1.default.formatApiResponse(200, res, editResult);
});
Posts.purge = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    yield api.posts.purge(req, { pid: req.params.pid });
    helpers_1.default.formatApiResponse(200, res);
});
Posts.restore = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    yield api.posts.restore(req, { pid: req.params.pid });
    helpers_1.default.formatApiResponse(200, res);
});
Posts.delete = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    yield api.posts.delete(req, { pid: req.params.pid });
    helpers_1.default.formatApiResponse(200, res);
});
Posts.move = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    yield api.posts.move(req, {
        pid: req.params.pid,
        tid: req.body.tid,
    });
    helpers_1.default.formatApiResponse(200, res);
});
function mock(req) {
    return __awaiter(this, void 0, void 0, function* () {
        const tid = yield posts.getPostField(req.params.pid, 'tid');
        return { pid: req.params.pid, room_id: `topic_${tid}` };
    });
}
Posts.vote = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const data = yield mock(req);
    if (req.body.delta > 0) {
        yield api.posts.upvote(req, data);
    }
    else if (req.body.delta < 0) {
        yield api.posts.downvote(req, data);
    }
    else {
        yield api.posts.unvote(req, data);
    }
    helpers_1.default.formatApiResponse(200, res);
});
Posts.unvote = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const data = yield mock(req);
    yield api.posts.unvote(req, data);
    helpers_1.default.formatApiResponse(200, res);
});
Posts.bookmark = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const data = yield mock(req);
    yield api.posts.bookmark(req, data);
    helpers_1.default.formatApiResponse(200, res);
});
Posts.unbookmark = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const data = yield mock(req);
    yield api.posts.unbookmark(req, data);
    helpers_1.default.formatApiResponse(200, res);
});
Posts.getDiffs = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    helpers_1.default.formatApiResponse(200, res, yield api.posts.getDiffs(req, Object.assign({}, req.params)));
});
Posts.loadDiff = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    helpers_1.default.formatApiResponse(200, res, yield api.posts.loadDiff(req, Object.assign({}, req.params)));
});
Posts.restoreDiff = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    helpers_1.default.formatApiResponse(200, res, yield api.posts.restoreDiff(req, Object.assign({}, req.params)));
});
Posts.deleteDiff = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    if (!parseInt(req.params.pid, 10)) {
        throw new Error('[[error:invalid-data]]');
    }
    const cid = yield posts.getCidByPid(req.params.pid);
    const [isAdmin, isModerator] = yield Promise.all([
        privileges.users.isAdministrator(req.uid),
        privileges.users.isModerator(req.uid, cid),
    ]);
    if (!(isAdmin || isModerator)) {
        return helpers_1.default.formatApiResponse(403, res, new Error('[[error:no-privileges]]'));
    }
    yield posts.diffs.delete(req.params.pid, req.params.timestamp, req.uid);
    helpers_1.default.formatApiResponse(200, res, yield api.posts.getDiffs(req, Object.assign({}, req.params)));
});
