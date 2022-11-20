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
exports.default = {
    name: 'Changing ip blacklist storage to object',
    timestamp: Date.UTC(2017, 8, 7),
    method: function () {
        return __awaiter(this, void 0, void 0, function* () {
            const rules = yield database_1.default.get('ip-blacklist-rules');
            yield database_1.default.delete('ip-blacklist-rules');
            yield database_1.default.setObject('ip-blacklist-rules', { rules: rules });
        });
    },
};
