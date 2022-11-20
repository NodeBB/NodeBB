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
const user_1 = __importDefault(require("../user"));
const meta_1 = __importDefault(require("../meta"));
const events = require('../events');
const SocketBlacklist = {};
SocketBlacklist.validate = function (socket, data) {
    return __awaiter(this, void 0, void 0, function* () {
        return meta_1.default.blacklist.validate(data.rules);
    });
};
SocketBlacklist.save = function (socket, rules) {
    return __awaiter(this, void 0, void 0, function* () {
        yield blacklist(socket, 'save', rules);
    });
};
SocketBlacklist.addRule = function (socket, rule) {
    return __awaiter(this, void 0, void 0, function* () {
        yield blacklist(socket, 'addRule', rule);
    });
};
function blacklist(socket, method, rule) {
    return __awaiter(this, void 0, void 0, function* () {
        const isAdminOrGlobalMod = yield user_1.default.isAdminOrGlobalMod(socket.uid);
        if (!isAdminOrGlobalMod) {
            throw new Error('[[error:no-privileges]]');
        }
        yield meta_1.default.blacklist[method](rule);
        yield events.log({
            type: `ip-blacklist-${method}`,
            uid: socket.uid,
            ip: socket.ip,
            rule: rule,
        });
    });
}
require('../promisify').promisify(SocketBlacklist);
