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
exports.ratelimit = exports.clearCache = void 0;
const cacheCreate = require('../cache/ttl').default;
const meta_1 = __importDefault(require("../meta"));
const helpers = require('./helpers').default;
const user_1 = __importDefault(require("../user"));
console.log('ttl', meta_1.default.config);
const cache = cacheCreate({
    ttl: Infinity
    //ttl: meta.config.uploadRateLimitCooldown * 1000,
});
const clearCache = function () {
    cache.clear();
};
exports.clearCache = clearCache;
exports.ratelimit = helpers.try((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const { uid } = req;
    if (!meta_1.default.config.uploadRateLimitThreshold || (uid && (yield user_1.default.isAdminOrGlobalMod(uid)))) {
        return next();
    }
    const count = (cache.get(`${req.ip}:uploaded_file_count`) || 0) + req.files.files.length;
    if (count > meta_1.default.config.uploadRateLimitThreshold) {
        return next(new Error(['[[error:upload-ratelimit-reached]]']));
    }
    cache.set(`${req.ip}:uploaded_file_count`, count);
    next();
}));
