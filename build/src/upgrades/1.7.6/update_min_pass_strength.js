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
    name: 'Revising minimum password strength to 1 (from 0)',
    timestamp: Date.UTC(2018, 1, 21),
    method: function () {
        return __awaiter(this, void 0, void 0, function* () {
            const strength = yield database_1.default.getObjectField('config', 'minimumPasswordStrength');
            if (!strength) {
                yield database_1.default.setObjectField('config', 'minimumPasswordStrength', 1);
            }
        });
    },
};
