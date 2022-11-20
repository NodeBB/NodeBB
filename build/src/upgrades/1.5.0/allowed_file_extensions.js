'use strict';
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const database_1 = __importDefault(require("../../database"));
exports.default = {
    name: 'Set default allowed file extensions',
    timestamp: Date.UTC(2017, 3, 14),
    method: function (callback) {
        database_1.default.getObjectField('config', 'allowedFileExtensions', (err, value) => {
            if (err || value) {
                return callback(err);
            }
            database_1.default.setObjectField('config', 'allowedFileExtensions', 'png,jpg,bmp', callback);
        });
    },
};
