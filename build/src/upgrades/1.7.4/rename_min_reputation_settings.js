'use strict';
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const database_1 = __importDefault(require("../../database"));
exports.default = {
    name: 'Rename privileges:downvote and privileges:flag to min:rep:downvote, min:rep:flag respectively',
    timestamp: Date.UTC(2018, 0, 12),
    method: function (callback) {
        database_1.default.getObjectFields('config', ['privileges:downvote', 'privileges:flag'], (err, config) => {
            if (err) {
                return callback(err);
            }
            database_1.default.setObject('config', {
                'min:rep:downvote': parseInt(config['privileges:downvote'], 10) || 0,
                'min:rep:flag': parseInt(config['privileges:downvote'], 10) || 0,
            }, (err) => {
                if (err) {
                    return callback(err);
                }
                database_1.default.deleteObjectFields('config', ['privileges:downvote', 'privileges:flag'], callback);
            });
        });
    },
};
