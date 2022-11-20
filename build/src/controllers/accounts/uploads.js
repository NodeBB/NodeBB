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
const path_1 = __importDefault(require("path"));
const nconf_1 = __importDefault(require("nconf"));
const database_1 = __importDefault(require("../../database"));
const helpers_1 = __importDefault(require("../helpers"));
const meta_1 = __importDefault(require("../../meta"));
const pagination = require('../../pagination');
const accountHelpers = require('./helpers').defualt;
const uploadsController = {};
uploadsController.get = function (req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        const userData = yield accountHelpers.getUserDataByUserSlug(req.params.userslug, req.uid, req.query);
        if (!userData) {
            return next();
        }
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const itemsPerPage = 25;
        const start = (page - 1) * itemsPerPage;
        const stop = start + itemsPerPage - 1;
        const [itemCount, uploadNames] = yield Promise.all([
            database_1.default.sortedSetCard(`uid:${userData.uid}:uploads`),
            database_1.default.getSortedSetRevRange(`uid:${userData.uid}:uploads`, start, stop),
        ]);
        userData.uploads = uploadNames.map((uploadName) => ({
            name: uploadName,
            url: path_1.default.resolve(nconf_1.default.get('upload_url'), uploadName),
        }));
        const pageCount = Math.ceil(itemCount / itemsPerPage);
        userData.pagination = pagination.create(page, pageCount, req.query);
        userData.privateUploads = meta_1.default.config.privateUploads === 1;
        userData.title = `[[pages:account/uploads, ${userData.username}]]`;
        userData.breadcrumbs = helpers_1.default.buildBreadcrumbs([{ text: userData.username, url: `/user/${userData.userslug}` }, { text: '[[global:uploads]]' }]);
        res.render('account/uploads', userData);
    });
};
