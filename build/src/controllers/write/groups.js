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
const api = require('../../api');
const helpers_1 = __importDefault(require("../helpers"));
const Groups = {};
Groups.exists = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    helpers_1.default.formatApiResponse(200, res);
});
Groups.create = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const groupObj = yield api.groups.create(req, req.body);
    helpers_1.default.formatApiResponse(200, res, groupObj);
});
Groups.update = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const groupObj = yield api.groups.update(req, Object.assign(Object.assign({}, req.body), { slug: req.params.slug }));
    helpers_1.default.formatApiResponse(200, res, groupObj);
});
Groups.delete = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    yield api.groups.delete(req, req.params);
    helpers_1.default.formatApiResponse(200, res);
});
Groups.join = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    yield api.groups.join(req, req.params);
    helpers_1.default.formatApiResponse(200, res);
});
Groups.leave = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    yield api.groups.leave(req, req.params);
    helpers_1.default.formatApiResponse(200, res);
});
Groups.grant = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    yield api.groups.grant(req, req.params);
    helpers_1.default.formatApiResponse(200, res);
});
Groups.rescind = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    yield api.groups.rescind(req, req.params);
    helpers_1.default.formatApiResponse(200, res);
});
