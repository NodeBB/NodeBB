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
const meta_1 = __importDefault(require("../../meta"));
const userDigest = require('../../user/digest');
const Digest = {};
Digest.resend = (socket, data) => __awaiter(void 0, void 0, void 0, function* () {
    const { uid } = data;
    const interval = data.action.startsWith('resend-') ? data.action.slice(7) : yield userDigest.getUsersInterval(uid);
    if (!interval && meta_1.default.config.dailyDigestFreq === 'off') {
        throw new Error('[[error:digest-not-enabled]]');
    }
    if (uid) {
        yield userDigest.execute({
            interval: interval || meta_1.default.config.dailyDigestFreq,
            subscribers: [uid],
        });
    }
    else {
        yield userDigest.execute({ interval: interval });
    }
});
