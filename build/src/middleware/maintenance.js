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
const util = require('util');
const nconf_1 = __importDefault(require("nconf"));
const meta_1 = __importDefault(require("../meta"));
const user_1 = __importDefault(require("../user"));
const groups = require('../groups');
const helpers = require('./helpers').default;
function default_1(middleware) {
    middleware.maintenanceMode = helpers.try((req, res, next) => __awaiter(this, void 0, void 0, function* () {
        if (!meta_1.default.config.maintenanceMode) {
            return next();
        }
        const hooksAsync = util.promisify(middleware.pluginHooks);
        yield hooksAsync(req, res);
        const url = req.url.replace(nconf_1.default.get('relative_path'), '');
        if (url.startsWith('/login') || url.startsWith('/api/login')) {
            return next();
        }
        const [isAdmin, isMemberOfExempt] = yield Promise.all([
            user_1.default.isAdministrator(req.uid),
            groups.isMemberOfAny(req.uid, meta_1.default.config.groupsExemptFromMaintenanceMode),
        ]);
        if (isAdmin || isMemberOfExempt) {
            return next();
        }
        res.status(meta_1.default.config.maintenanceModeStatus);
        const data = {
            site_title: meta_1.default.config.title || 'NodeBB',
            message: meta_1.default.config.maintenanceModeMessage,
        };
        if (res.locals.isAPI) {
            return res.json(data);
        }
        yield middleware.buildHeaderAsync(req, res);
        res.render('503', data);
    }));
}
exports.default = default_1;
;
