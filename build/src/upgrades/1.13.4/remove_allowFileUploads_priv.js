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
const privileges = require('../../privileges');
exports.default = {
    name: 'Removing file upload privilege if file uploads were disabled (`allowFileUploads`)',
    timestamp: Date.UTC(2020, 4, 21),
    method: () => __awaiter(void 0, void 0, void 0, function* () {
        const allowFileUploads = parseInt(yield database_1.default.getObjectField('config', 'allowFileUploads'), 10);
        if (allowFileUploads === 1) {
            yield database_1.default.deleteObjectField('config', 'allowFileUploads');
            return;
        }
        // Remove `upload:post:file` privilege for all groups
        yield privileges.categories.rescind(['groups:upload:post:file'], 0, ['guests', 'registered-users', 'Global Moderators']);
        // Clean up the old option from the config hash
        yield database_1.default.deleteObjectField('config', 'allowFileUploads');
    }),
};
