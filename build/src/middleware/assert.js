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
/**
 * The middlewares here strictly act to "assert" validity of the incoming
 * payload and throw an error otherwise.
 */
const path_1 = __importDefault(require("path"));
const nconf_1 = __importDefault(require("nconf"));
const file = require('../file');
const user_1 = __importDefault(require("../user"));
const groups = require('../groups');
const topics = require('../topics');
const posts = require('../posts');
const messaging = require('../messaging');
const flags = require('../flags');
const slugify = require('../slugify');
const helpers = require('./helpers').defualt;
const controllerHelpers = require('../controllers/helpers');
const Assert = {};
Assert.user = helpers.try((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    if (!(yield user_1.default.exists(req.params.uid))) {
        return controllerHelpers.formatApiResponse(404, res, new Error('[[error:no-user]]'));
    }
    next();
}));
Assert.group = helpers.try((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const name = yield groups.getGroupNameByGroupSlug(req.params.slug);
    if (!name || !(yield groups.exists(name))) {
        return controllerHelpers.formatApiResponse(404, res, new Error('[[error:no-group]]'));
    }
    next();
}));
Assert.topic = helpers.try((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    if (!(yield topics.exists(req.params.tid))) {
        return controllerHelpers.formatApiResponse(404, res, new Error('[[error:no-topic]]'));
    }
    next();
}));
Assert.post = helpers.try((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    if (!(yield posts.exists(req.params.pid))) {
        return controllerHelpers.formatApiResponse(404, res, new Error('[[error:no-post]]'));
    }
    next();
}));
Assert.flag = helpers.try((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const canView = yield flags.canView(req.params.flagId, req.uid);
    if (!canView) {
        return controllerHelpers.formatApiResponse(404, res, new Error('[[error:no-flag]]'));
    }
    next();
}));
Assert.path = helpers.try((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    // file: URL support
    if (req.body.path.startsWith('file:///')) {
        req.body.path = new URL(req.body.path).pathname;
    }
    // Strip upload_url if found
    if (req.body.path.startsWith(nconf_1.default.get('upload_url'))) {
        req.body.path = req.body.path.slice(nconf_1.default.get('upload_url').length);
    }
    const pathToFile = path_1.default.join(nconf_1.default.get('upload_path'), req.body.path);
    res.locals.cleanedPath = pathToFile;
    // Guard against path traversal
    if (!pathToFile.startsWith(nconf_1.default.get('upload_path'))) {
        return controllerHelpers.formatApiResponse(403, res, new Error('[[error:invalid-path]]'));
    }
    if (!(yield file.exists(pathToFile))) {
        return controllerHelpers.formatApiResponse(404, res, new Error('[[error:invalid-path]]'));
    }
    next();
}));
Assert.folderName = helpers.try((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const folderName = slugify(path_1.default.basename(req.body.folderName.trim()));
    const folderPath = path_1.default.join(res.locals.cleanedPath, folderName);
    // slugify removes invalid characters, folderName may become empty
    if (!folderName) {
        return controllerHelpers.formatApiResponse(403, res, new Error('[[error:invalid-path]]'));
    }
    if (yield file.exists(folderPath)) {
        return controllerHelpers.formatApiResponse(403, res, new Error('[[error:folder-exists]]'));
    }
    res.locals.folderPath = folderPath;
    next();
}));
Assert.room = helpers.try((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    if (!isFinite(req.params.roomId)) {
        return controllerHelpers.formatApiResponse(400, res, new Error('[[error:invalid-data]]'));
    }
    const [exists, inRoom] = yield Promise.all([
        yield messaging.roomExists(req.params.roomId),
        yield messaging.isUserInRoom(req.uid, req.params.roomId),
    ]);
    if (!exists) {
        return controllerHelpers.formatApiResponse(404, res, new Error('[[error:chat-room-does-not-exist]]'));
    }
    if (!inRoom) {
        return controllerHelpers.formatApiResponse(403, res, new Error('[[error:no-privileges]]'));
    }
    next();
}));
Assert.message = helpers.try((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    if (!isFinite(req.params.mid) ||
        !(yield messaging.messageExists(req.params.mid)) ||
        !(yield messaging.canViewMessage(req.params.mid, req.params.roomId, req.uid))) {
        return controllerHelpers.formatApiResponse(400, res, new Error('[[error:invalid-mid]]'));
    }
    next();
}));
