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
const flags = require('../../flags');
const api = require('../../api');
const helpers_1 = __importDefault(require("../helpers"));
const Flags = {};
Flags.create = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const flagObj = yield api.flags.create(req, Object.assign({}, req.body));
    helpers_1.default.formatApiResponse(200, res, (yield user_1.default.isPrivileged(req.uid)) ? flagObj : undefined);
});
Flags.get = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const isPrivileged = yield user_1.default.isPrivileged(req.uid);
    if (!isPrivileged) {
        return helpers_1.default.formatApiResponse(403, res);
    }
    helpers_1.default.formatApiResponse(200, res, yield flags.get(req.params.flagId));
});
Flags.update = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const history = yield api.flags.update(req, Object.assign({ flagId: req.params.flagId }, req.body));
    helpers_1.default.formatApiResponse(200, res, { history });
});
Flags.delete = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    yield flags.purge([req.params.flagId]);
    helpers_1.default.formatApiResponse(200, res);
});
Flags.appendNote = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const payload = yield api.flags.appendNote(req, Object.assign({ flagId: req.params.flagId }, req.body));
    helpers_1.default.formatApiResponse(200, res, payload);
});
Flags.deleteNote = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const payload = yield api.flags.deleteNote(req, Object.assign({}, req.params));
    helpers_1.default.formatApiResponse(200, res, payload);
});
