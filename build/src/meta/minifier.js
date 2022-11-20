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
const fs = __importStar(require("fs"));
const os = require('os');
const async = require('async');
const winston_1 = __importDefault(require("winston"));
const postcss = require('postcss');
const autoprefixer = require('autoprefixer');
const clean = require('postcss-clean');
const rtlcss = require('rtlcss');
const sass = require('../utils').default.getSass();
const fork = require('./debugFork');
require('../file'); // for graceful-fs
const Minifier = {};
const pool = [];
const free = [];
let maxThreads = 0;
Object.defineProperty(Minifier, 'maxThreads', {
    get: function () {
        return maxThreads;
    },
    set: function (val) {
        maxThreads = val;
        if (!process.env.minifier_child) {
            winston_1.default.verbose(`[minifier] utilizing a maximum of ${maxThreads} additional threads`);
        }
    },
    configurable: true,
    enumerable: true,
});
Minifier.maxThreads = os.cpus().length - 1;
Minifier.killAll = function () {
    pool.forEach((child) => {
        child.kill('SIGTERM');
    });
    pool.length = 0;
    free.length = 0;
};
function getChild() {
    if (free.length) {
        return free.shift();
    }
    const proc = fork(__filename, [], {
        cwd: __dirname,
        env: {
            minifier_child: true,
        },
    });
    pool.push(proc);
    return proc;
}
function freeChild(proc) {
    proc.removeAllListeners();
    free.push(proc);
}
function removeChild(proc) {
    const i = pool.indexOf(proc);
    if (i !== -1) {
        pool.splice(i, 1);
    }
}
function forkAction(action) {
    return new Promise((resolve, reject) => {
        const proc = getChild();
        proc.on('message', (message) => {
            freeChild(proc);
            if (message.type === 'error') {
                return reject(new Error(message.message));
            }
            if (message.type === 'end') {
                resolve(message.result);
            }
        });
        proc.on('error', (err) => {
            proc.kill();
            removeChild(proc);
            reject(err);
        });
        proc.send({
            type: 'action',
            action: action,
        });
    });
}
const actions = {};
if (process.env.minifier_child) {
    process.on('message', (message) => __awaiter(void 0, void 0, void 0, function* () {
        if (message.type === 'action') {
            const { action } = message;
            if (typeof actions[action.act] !== 'function') {
                process.send({
                    type: 'error',
                    message: 'Unknown action',
                });
                return;
            }
            try {
                const result = yield actions[action.act](action);
                process.send({
                    type: 'end',
                    result: result,
                });
            }
            catch (err) {
                process.send({
                    type: 'error',
                    message: err.stack || err.message || 'unknown error',
                });
            }
        }
    }));
}
function executeAction(action, fork) {
    return __awaiter(this, void 0, void 0, function* () {
        if (fork && (pool.length - free.length) < Minifier.maxThreads) {
            return yield forkAction(action);
        }
        if (typeof actions[action.act] !== 'function') {
            throw new Error('Unknown action');
        }
        return yield actions[action.act](action);
    });
}
actions.concat = function concat(data) {
    return __awaiter(this, void 0, void 0, function* () {
        if (data.files && data.files.length) {
            const files = yield async.mapLimit(data.files, 1000, (ref) => __awaiter(this, void 0, void 0, function* () { return yield fs.promises.readFile(ref.srcPath, 'utf8'); }));
            const output = files.join('\n;');
            yield fs.promises.writeFile(data.destPath, output);
        }
    });
};
Minifier.js = {};
Minifier.js.bundle = function (data, fork) {
    return __awaiter(this, void 0, void 0, function* () {
        return yield executeAction({
            act: 'concat',
            files: data.files,
            filename: data.filename,
            destPath: data.destPath,
        }, fork);
    });
};
actions.buildCSS = function buildCSS(data) {
    return __awaiter(this, void 0, void 0, function* () {
        const scssOutput = yield sass.compileStringAsync(data.source, {
            loadPaths: data.paths,
        });
        function processScss(direction) {
            return __awaiter(this, void 0, void 0, function* () {
                const postcssArgs = [autoprefixer];
                if (direction === 'rtl') {
                    postcssArgs.unshift(rtlcss());
                }
                if (data.minify) {
                    postcssArgs.push(clean({
                        processImportFrom: ['local'],
                    }));
                }
                return yield postcss(postcssArgs).process(scssOutput.css.toString(), {
                    from: undefined,
                });
            });
        }
        const [ltrresult, rtlresult] = yield Promise.all([
            processScss('ltr'),
            processScss('rtl'),
        ]);
        return {
            ltr: { code: ltrresult.css },
            rtl: { code: rtlresult.css },
        };
    });
};
Minifier.css = {};
Minifier.css.bundle = function (source, paths, minify, fork) {
    return __awaiter(this, void 0, void 0, function* () {
        return yield executeAction({
            act: 'buildCSS',
            source: source,
            paths: paths,
            minify: minify,
        }, fork);
    });
};
__exportStar(require("../promisify"), exports);
require('../promisify').promisify(Minifier);
exports.default = Minifier;
