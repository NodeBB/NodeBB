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
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
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
exports.read = exports.write = void 0;
const fs = __importStar(require("fs"));
const path_1 = __importDefault(require("path"));
const mkdirp = require('mkdirp');
const winston_1 = __importDefault(require("winston"));
const filePath = path_1.default.join(__dirname, '../../build/cache-buster');
let cached;
// cache buster is an 11-character, lowercase, alphanumeric string
function generate() {
    return (Math.random() * 1e18).toString(32).slice(0, 11);
}
const write = function write() {
    return __awaiter(this, void 0, void 0, function* () {
        yield mkdirp(path_1.default.dirname(filePath));
        yield fs.promises.writeFile(filePath, generate());
    });
};
exports.write = write;
const read = function read() {
    return __awaiter(this, void 0, void 0, function* () {
        if (cached) {
            return cached;
        }
        try {
            const buster = yield fs.promises.readFile(filePath, 'utf8');
            if (!buster || buster.length !== 11) {
                winston_1.default.warn(`[cache-buster] cache buster string invalid: expected /[a-z0-9]{11}/, got \`${buster}\``);
                return generate();
            }
            cached = buster;
            return cached;
        }
        catch (err) {
            winston_1.default.warn('[cache-buster] could not read cache buster', err);
            return generate();
        }
    });
};
exports.read = read;
__exportStar(require("../promisify"), exports);
