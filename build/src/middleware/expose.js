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
 * The middlewares here strictly act to "expose" certain values from the database,
 * into `res.locals` for use in middlewares and/or controllers down the line
 */
const user_1 = __importDefault(require("../user"));
const privileges = require('../privileges');
const utils = require('../utils');
function default_1(middleware) {
    middleware.exposeAdmin = (req, res, next) => __awaiter(this, void 0, void 0, function* () {
        // Unlike `requireAdmin`, this middleware just checks the uid, and sets `isAdmin` in `res.locals`
        res.locals.isAdmin = false;
        if (!req.user) {
            return next();
        }
        res.locals.isAdmin = yield user_1.default.isAdministrator(req.user.uid);
        next();
    });
    middleware.exposePrivileges = (req, res, next) => __awaiter(this, void 0, void 0, function* () {
        // Exposes a hash of user's ranks (admin, gmod, etc.)
        const hash = yield utils.promiseParallel({
            isAdmin: user_1.default.isAdministrator(req.user.uid),
            isGmod: user_1.default.isGlobalModerator(req.user.uid),
            isPrivileged: user_1.default.isPrivileged(req.user.uid),
        });
        if (req.params.uid) {
            hash.isSelf = parseInt(req.params.uid, 10) === req.user.uid;
        }
        res.locals.privileges = hash;
        next();
    });
    middleware.exposePrivilegeSet = (req, res, next) => __awaiter(this, void 0, void 0, function* () {
        // Exposes a user's global/admin privilege set
        res.locals.privileges = Object.assign(Object.assign({}, yield privileges.global.get(req.user.uid)), yield privileges.admin.get(req.user.uid));
        next();
    });
}
exports.default = default_1;
;
