'use strict';
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const database_1 = __importDefault(require("../../database"));
const meta_1 = __importDefault(require("../../meta"));
exports.default = {
    name: 'Generate customHTML block from old customJS setting',
    timestamp: Date.UTC(2017, 9, 12),
    method: function (callback) {
        database_1.default.getObjectField('config', 'customJS', (err, newHTML) => {
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
