'use strict';
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
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
const database = __importStar(require("../../database"));
const db = database;
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
            db.sortedSetCard(`uid:${userData.uid}:uploads`),
            db.getSortedSetRevRange(`uid:${userData.uid}:uploads`, start, stop),
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
