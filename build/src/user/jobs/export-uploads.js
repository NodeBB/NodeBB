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
const nconf_1 = __importDefault(require("nconf"));
nconf_1.default.argv().env({
    separator: '__',
});
const fs = __importStar(require("fs"));
const path_1 = __importDefault(require("path"));
const archiver = require('archiver');
const winston_1 = __importDefault(require("winston"));
process.env.NODE_ENV = process.env.NODE_ENV || 'production';
// Alternate configuration file support
const configFile = path_1.default.resolve(__dirname, '../../../', nconf_1.default.any(['config', 'CONFIG']) || 'config.json');
const prestart = require('../../prestart');
prestart.loadConfig(configFile);
prestart.setupWinston();
const database_1 = __importDefault(require("../../database"));
process.on('message', (msg) => __awaiter(void 0, void 0, void 0, function* () {
    if (msg && msg.uid) {
        yield database_1.default.init();
        const targetUid = msg.uid;
        const archivePath = path_1.default.join(__dirname, '../../../build/export', `${targetUid}_uploads.zip`);
        const rootDirectory = path_1.default.join(__dirname, '../../../../public/uploads/');
        const user = require('../index');
        const archive = archiver('zip', {
            zlib: { level: 9 }, // Sets the compression level.
        });
        archive.on('warning', (err) => {
            switch (err.code) {
                case 'ENOENT':
                    winston_1.default.warn(`[user/export/uploads] File not found: ${err.path}`);
                    break;
                default:
                    winston_1.default.warn(`[user/export/uploads] Unexpected warning: ${err.message}`);
                    break;
            }
        });
        archive.on('error', (err) => {
            const trimPath = function (path) {
                return path.replace(rootDirectory, '');
            };
            switch (err.code) {
                case 'EACCES':
                    winston_1.default.error(`[user/export/uploads] File inaccessible: ${trimPath(err.path)}`);
                    break;
                default:
                    winston_1.default.error(`[user/export/uploads] Unable to construct archive: ${err.message}`);
                    break;
            }
        });
        const output = fs.createWriteStream(archivePath);
        output.on('close', () => __awaiter(void 0, void 0, void 0, function* () {
            yield database_1.default.close();
            process.exit(0);
        }));
        archive.pipe(output);
        winston_1.default.verbose(`[user/export/uploads] Collating uploads for uid ${targetUid}`);
        yield user.collateUploads(targetUid, archive);
        const uploadedPicture = yield user.getUserField(targetUid, 'uploadedpicture');
        if (uploadedPicture) {
            const filePath = uploadedPicture.replace(nconf_1.default.get('upload_url'), '');
            archive.file(path_1.default.join(nconf_1.default.get('upload_path'), filePath), {
                name: path_1.default.basename(filePath),
            });
        }
        archive.finalize();
    }
}));
