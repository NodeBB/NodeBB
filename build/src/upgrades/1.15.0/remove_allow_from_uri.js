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
exports.default = {
    name: 'Remove allow from uri setting',
    timestamp: Date.UTC(2020, 8, 6),
    method: function () {
        return __awaiter(this, void 0, void 0, function* () {
            if (meta_1.default.config['allow-from-uri']) {
                yield database_1.default.setObjectField('config', 'csp-frame-ancestors', meta_1.default.config['allow-from-uri']);
            }
            yield database_1.default.deleteObjectField('config', 'allow-from-uri');
        });
    },
};
