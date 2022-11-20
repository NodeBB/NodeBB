'use strict';
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const database_1 = __importDefault(require("../../database"));
const meta_1 = __importDefault(require("../../meta"));
exports.default = {
    name: 'Update registration type',
    timestamp: Date.UTC(2019, 5, 4),
    method: function (callback) {
        const registrationType = meta_1.default.config.registrationType || 'normal';
        if (registrationType === 'admin-approval' || registrationType === 'admin-approval-ip') {
            database_1.default.setObject('config', {
                registrationType: 'normal',
                registrationApprovalType: registrationType,
            }, callback);
        }
        else {
            setImmediate(callback);
        }
    },
};
