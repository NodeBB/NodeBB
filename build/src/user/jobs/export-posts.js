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
const json2csvAsync = require('json2csv').parseAsync;
process.env.NODE_ENV = process.env.NODE_ENV || 'production';
// Alternate configuration file support
const configFile = path_1.default.resolve(__dirname, '../../../', nconf_1.default.any(['config', 'CONFIG']) || 'config.json');
const prestart = require('../../prestart');
prestart.loadConfig(configFile);
prestart.setupWinston();
const database_1 = __importDefault(require("../../database"));
const batch = require('../../batch');
process.on('message', (msg) => __awaiter(void 0, void 0, void 0, function* () {
    if (msg && msg.uid) {
        yield database_1.default.init();
        const targetUid = msg.uid;
        const filePath = path_1.default.join(__dirname, '../../../build/export', `${targetUid}_posts.csv`);
        const posts = require('../../posts');
        let payload = [];
        yield batch.processSortedSet(`uid:${targetUid}:posts`, (pids) => __awaiter(void 0, void 0, void 0, function* () {
            let postData = yield posts.getPostsData(pids);
            // Remove empty post references and convert newlines in content
            postData = postData.filter(Boolean).map((post) => {
                post.content = `"${String(post.content || '').replace(/\n/g, '\\n').replace(/"/g, '\\"')}"`;
                return post;
            });
            payload = payload.concat(postData);
        }), {
            batch: 500,
            interval: 1000,
        });
        const fields = payload.length ? Object.keys(payload[0]) : [];
        const opts = { fields };
        const csv = yield json2csvAsync(payload, opts);
        yield fs.promises.writeFile(filePath, csv);
        yield database_1.default.close();
        process.exit(0);
    }
}));
