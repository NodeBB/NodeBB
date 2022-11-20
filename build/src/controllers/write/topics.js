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
const validator = require('validator');
const api = require('../../api');
const topics = require('../../topics');
const privileges = require('../../privileges');
const helpers_1 = __importDefault(require("../helpers"));
const middleware = require('../../middleware');
const uploadsController = require('../uploads');
const Topics = {};
Topics.get = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    helpers_1.default.formatApiResponse(200, res, yield api.topics.get(req, req.params));
});
Topics.create = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const payload = yield api.topics.create(req, req.body);
    if (payload.queued) {
        helpers_1.default.formatApiResponse(202, res, payload);
    }
    else {
        helpers_1.default.formatApiResponse(200, res, payload);
    }
});
Topics.reply = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const payload = yield api.topics.reply(req, Object.assign(Object.assign({}, req.body), { tid: req.params.tid }));
    helpers_1.default.formatApiResponse(200, res, payload);
});
Topics.delete = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    yield api.topics.delete(req, { tids: [req.params.tid] });
    helpers_1.default.formatApiResponse(200, res);
});
Topics.restore = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    yield api.topics.restore(req, { tids: [req.params.tid] });
    helpers_1.default.formatApiResponse(200, res);
});
Topics.purge = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    yield api.topics.purge(req, { tids: [req.params.tid] });
    helpers_1.default.formatApiResponse(200, res);
});
Topics.pin = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    // Pin expiry was not available w/ sockets hence not included in api lib method
    if (req.body.expiry) {
        yield topics.tools.setPinExpiry(req.params.tid, req.body.expiry, req.uid);
    }
    yield api.topics.pin(req, { tids: [req.params.tid] });
    helpers_1.default.formatApiResponse(200, res);
});
Topics.unpin = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    yield api.topics.unpin(req, { tids: [req.params.tid] });
    helpers_1.default.formatApiResponse(200, res);
});
Topics.lock = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    yield api.topics.lock(req, { tids: [req.params.tid] });
    helpers_1.default.formatApiResponse(200, res);
});
Topics.unlock = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    yield api.topics.unlock(req, { tids: [req.params.tid] });
    helpers_1.default.formatApiResponse(200, res);
});
Topics.follow = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    yield api.topics.follow(req, req.params);
    helpers_1.default.formatApiResponse(200, res);
});
Topics.ignore = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    yield api.topics.ignore(req, req.params);
    helpers_1.default.formatApiResponse(200, res);
});
Topics.unfollow = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    yield api.topics.unfollow(req, req.params);
    helpers_1.default.formatApiResponse(200, res);
});
Topics.addTags = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    if (!(yield privileges.topics.canEdit(req.params.tid, req.user.uid))) {
        return helpers_1.default.formatApiResponse(403, res);
    }
    const cid = yield topics.getTopicField(req.params.tid, 'cid');
    yield topics.validateTags(req.body.tags, cid, req.user.uid, req.params.tid);
    const tags = yield topics.filterTags(req.body.tags);
    yield topics.addTags(tags, [req.params.tid]);
    helpers_1.default.formatApiResponse(200, res);
});
Topics.deleteTags = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    if (!(yield privileges.topics.canEdit(req.params.tid, req.user.uid))) {
        return helpers_1.default.formatApiResponse(403, res);
    }
    yield topics.deleteTopicTags(req.params.tid);
    helpers_1.default.formatApiResponse(200, res);
});
Topics.getThumbs = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    if (isFinite(req.params.tid)) { // post_uuids can be passed in occasionally, in that case no checks are necessary
        const [exists, canRead] = yield Promise.all([
            topics.exists(req.params.tid),
            privileges.topics.can('topics:read', req.params.tid, req.uid),
        ]);
        if (!exists || !canRead) {
            return helpers_1.default.formatApiResponse(403, res);
        }
    }
    helpers_1.default.formatApiResponse(200, res, yield topics.thumbs.get(req.params.tid));
});
Topics.addThumb = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    yield checkThumbPrivileges({ tid: req.params.tid, uid: req.user.uid, res });
    if (res.headersSent) {
        return;
    }
    const files = yield uploadsController.uploadThumb(req, res); // response is handled here
    // Add uploaded files to topic zset
    if (files && files.length) {
        yield Promise.all(files.map((fileObj) => __awaiter(void 0, void 0, void 0, function* () {
            yield topics.thumbs.associate({
                id: req.params.tid,
                path: fileObj.path || fileObj.url,
            });
        })));
    }
});
Topics.migrateThumbs = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    yield Promise.all([
        checkThumbPrivileges({ tid: req.params.tid, uid: req.user.uid, res }),
        checkThumbPrivileges({ tid: req.body.tid, uid: req.user.uid, res }),
    ]);
    if (res.headersSent) {
        return;
    }
    yield topics.thumbs.migrate(req.params.tid, req.body.tid);
    helpers_1.default.formatApiResponse(200, res);
});
Topics.deleteThumb = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    if (!req.body.path.startsWith('http')) {
        yield middleware.assert.path(req, res, () => { });
        if (res.headersSent) {
            return;
        }
    }
    yield checkThumbPrivileges({ tid: req.params.tid, uid: req.user.uid, res });
    if (res.headersSent) {
        return;
    }
    yield topics.thumbs.delete(req.params.tid, req.body.path);
    helpers_1.default.formatApiResponse(200, res, yield topics.thumbs.get(req.params.tid));
});
Topics.reorderThumbs = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    yield checkThumbPrivileges({ tid: req.params.tid, uid: req.user.uid, res });
    if (res.headersSent) {
        return;
    }
    const exists = yield topics.thumbs.exists(req.params.tid, req.body.path);
    if (!exists) {
        return helpers_1.default.formatApiResponse(404, res);
    }
    yield topics.thumbs.associate({
        id: req.params.tid,
        path: req.body.path,
        score: req.body.order,
    });
    helpers_1.default.formatApiResponse(200, res);
});
function checkThumbPrivileges({ tid, uid, res }) {
    return __awaiter(this, void 0, void 0, function* () {
        // req.params.tid could be either a tid (pushing a new thumb to an existing topic)
        // or a post UUID (a new topic being composed)
        const isUUID = validator.isUUID(tid);
        // Sanity-check the tid if it's strictly not a uuid
        if (!isUUID && (isNaN(parseInt(tid, 10)) || !(yield topics.exists(tid)))) {
            return helpers_1.default.formatApiResponse(404, res, new Error('[[error:no-topic]]'));
        }
        // While drafts are not protected, tids are
        if (!isUUID && !(yield privileges.topics.canEdit(tid, uid))) {
            return helpers_1.default.formatApiResponse(403, res, new Error('[[error:no-privileges]]'));
        }
    });
}
Topics.getEvents = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    if (!(yield privileges.topics.can('topics:read', req.params.tid, req.uid))) {
        return helpers_1.default.formatApiResponse(403, res);
    }
    helpers_1.default.formatApiResponse(200, res, yield topics.events.get(req.params.tid, req.uid));
});
Topics.deleteEvent = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    if (!(yield privileges.topics.isAdminOrMod(req.params.tid, req.uid))) {
        return helpers_1.default.formatApiResponse(403, res);
    }
    yield topics.events.purge(req.params.tid, [req.params.eventId]);
    helpers_1.default.formatApiResponse(200, res);
});
