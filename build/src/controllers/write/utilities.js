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
const authenticationController = require('../authentication');
const helpers_1 = __importDefault(require("../helpers"));
const Utilities = {};
Utilities.ping = {};
Utilities.ping.get = (req, res) => {
    helpers_1.default.formatApiResponse(200, res, {
        pong: true,
    });
};
Utilities.ping.post = (req, res) => {
    helpers_1.default.formatApiResponse(200, res, {
        uid: req.user.uid,
        received: req.body,
    });
};
Utilities.login = (req, res) => {
    res.locals.redirectAfterLogin = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const userData = (yield user_1.default.getUsers([req.uid], req.uid)).pop();
        helpers_1.default.formatApiResponse(200, res, userData);
    });
    res.locals.noScriptErrors = (req, res, err, statusCode) => {
        helpers_1.default.formatApiResponse(statusCode, res, new Error(err));
    };
    authenticationController.login(req, res);
};
