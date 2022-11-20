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
const database_1 = __importDefault(require("../../database"));
const meta_1 = __importDefault(require("../../meta"));
const helpers_1 = __importDefault(require("../helpers"));
const accountHelpers = require('./helpers').defualt;
const consentController = {};
consentController.get = function (req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!meta_1.default.config.gdpr_enabled) {
            return next();
        }
        const userData = yield accountHelpers.getUserDataByUserSlug(req.params.userslug, req.uid, req.query);
        if (!userData) {
            return next();
        }
        const consented = yield database_1.default.getObjectField(`user:${userData.uid}`, 'gdpr_consent');
        userData.gdpr_consent = parseInt(consented, 10) === 1;
        userData.digest = {
            frequency: meta_1.default.config.dailyDigestFreq || 'off',
            enabled: meta_1.default.config.dailyDigestFreq !== 'off',
        };
        userData.title = '[[user:consent.title]]';
        userData.breadcrumbs = helpers_1.default.buildBreadcrumbs([{ text: userData.username, url: `/user/${userData.userslug}` }, { text: '[[user:consent.title]]' }]);
        res.render('account/consent', userData);
    });
};
