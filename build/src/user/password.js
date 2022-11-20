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
const nconf_1 = __importDefault(require("nconf"));
const database_1 = __importDefault(require("../database"));
const Password = require('../password');
function default_1(User) {
    User.hashPassword = function (password) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!password) {
                return password;
            }
            return yield Password.hash(nconf_1.default.get('bcrypt_rounds') || 12, password);
        });
    };
    User.isPasswordCorrect = function (uid, password, ip) {
        return __awaiter(this, void 0, void 0, function* () {
            password = password || '';
            let { password: hashedPassword, 'password:shaWrapped': shaWrapped, } = yield database_1.default.getObjectFields(`user:${uid}`, ['password', 'password:shaWrapped']);
            if (!hashedPassword) {
                // Non-existant user, submit fake hash for comparison
                hashedPassword = '';
            }
            try {
                User.isPasswordValid(password, 0);
            }
            catch (e) {
                return false;
            }
            yield User.auth.logAttempt(uid, ip);
            const ok = yield Password.compare(password, hashedPassword, !!parseInt(shaWrapped, 10));
            if (ok) {
                yield User.auth.clearLoginAttempts(uid);
            }
            return ok;
        });
    };
    User.hasPassword = function (uid) {
        return __awaiter(this, void 0, void 0, function* () {
            const hashedPassword = yield database_1.default.getObjectField(`user:${uid}`, 'password');
            return !!hashedPassword;
        });
    };
}
exports.default = default_1;
;
