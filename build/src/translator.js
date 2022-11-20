'use strict';
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const winston_1 = __importDefault(require("winston"));
function warn(msg) {
    winston_1.default.warn(msg);
}
exports.default = require('../../public/src/modules/translator.common')(require('./utils'), (lang, namespace) => {
    const languages = require('./languages');
    return languages.get(lang, namespace);
}, warn);
