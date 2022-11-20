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
const async = require('async');
const path_1 = __importDefault(require("path"));
const nconf_1 = __importDefault(require("nconf"));
const fs = __importStar(require("fs"));
const meta_1 = __importDefault(require("../../meta"));
const image = require('../../image');
exports.default = {
    name: 'Generate email logo for use in email header',
    timestamp: Date.UTC(2017, 6, 17),
    method: function (callback) {
        let skip = false;
        async.series([
            function (next) {
                // Resize existing logo (if present) to email header size
                const uploadPath = path_1.default.join(nconf_1.default.get('upload_path'), 'system', 'site-logo-x50.png');
                const sourcePath = meta_1.default.config['brand:logo'] ? path_1.default.join(nconf_1.default.get('upload_path'), 'system', path_1.default.basename(meta_1.default.config['brand:logo'])) : null;
                if (!sourcePath) {
                    skip = true;
                    return setImmediate(next);
                }
                fs.access(sourcePath, (err) => {
                    if (err || path_1.default.extname(sourcePath) === '.svg') {
                        skip = true;
                        return setImmediate(next);
                    }
                    image.resizeImage({
                        path: sourcePath,
                        target: uploadPath,
                        height: 50,
                    }, next);
                });
            },
            function (next) {
                if (skip) {
                    return setImmediate(next);
                }
                meta_1.default.configs.setMultiple({
                    'brand:logo': path_1.default.join('/assets/uploads/system', path_1.default.basename(meta_1.default.config['brand:logo'])),
                    'brand:emailLogo': '/assets/uploads/system/site-logo-x50.png',
                }, next);
            },
        ], callback);
    },
};
