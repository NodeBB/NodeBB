'use strict';
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const database = __importStar(require("../../database"));
const db = database;
const meta_1 = __importDefault(require("../../meta"));
exports.default = {
    name: 'Generate customHTML block from old customJS setting',
    timestamp: Date.UTC(2017, 9, 12),
    method: function (callback) {
        db.getObjectField('config', 'customJS', (err, newHTML) => {
            if (err) {
                return callback(err);
            }
            let newJS = [];
            // Forgive me for parsing HTML with regex...
            const scriptMatch = /^<script\s?(?!async|deferred)?>([\s\S]+?)<\/script>/m;
            let match = scriptMatch.exec(newHTML);
            while (match) {
                if (match[1]) {
                    // Append to newJS array
                    newJS.push(match[1].trim());
                    // Remove the match from the existing value
                    newHTML = ((match.index > 0 ? newHTML.slice(0, match.index) : '') + newHTML.slice(match.index + match[0].length)).trim();
                }
                match = scriptMatch.exec(newHTML);
            }
            // Combine newJS array
            newJS = newJS.join('\n\n');
            // Write both values to config
            meta_1.default.configs.setMultiple({
                customHTML: newHTML,
                customJS: newJS,
            }, callback);
        });
    },
};
