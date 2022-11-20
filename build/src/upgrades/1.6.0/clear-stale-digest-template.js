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
const crypto = require('crypto');
const meta_1 = __importDefault(require("../../meta"));
exports.default = {
    name: 'Clearing stale digest templates that were accidentally saved as custom',
    timestamp: Date.UTC(2017, 8, 6),
    method: function () {
        return __awaiter(this, void 0, void 0, function* () {
            const matches = [
                '112e541b40023d6530dd44df4b0d9c5d',
                '110b8805f70395b0282fd10555059e9f',
                '9538e7249edb369b2a25b03f2bd3282b', // digest @ 3314ab4b83138c7ae579ac1f1f463098b8c2d414
            ];
            const fieldset = yield meta_1.default.configs.getFields(['email:custom:digest']);
            const hash = fieldset['email:custom:digest'] ? crypto.createHash('md5').update(fieldset['email:custom:digest']).digest('hex') : null;
            if (matches.includes(hash)) {
                yield meta_1.default.configs.remove('email:custom:digest');
            }
        });
    },
};
