'use strict';
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
const os = require('os');
const winston_1 = __importDefault(require("winston"));
const nconf_1 = __importDefault(require("nconf"));
const { exec } = require('child_process');
const pubsub = require('../../pubsub').default;
const rooms = require('../../socket.io/admin/rooms');
const infoController = {};
let info = {};
let previousUsage = process.cpuUsage();
let usageStartDate = Date.now();
infoController.get = function (req, res) {
    info = {};
    pubsub.publish('sync:node:info:start');
    const timeoutMS = 1000;
    setTimeout(() => {
        const data = [];
        Object.keys(info).forEach(key => data.push(info[key]));
        data.sort((a, b) => {
            if (a.id < b.id) {
                return -1;
            }
            if (a.id > b.id) {
                return 1;
            }
            return 0;
        });
        let port = nconf_1.default.get('port');
        if (!Array.isArray(port) && !isNaN(parseInt(port, 10))) {
            port = [port];
        }
        res.render('admin/development/info', {
            info: data,
            infoJSON: JSON.stringify(data, null, 4),
            host: os.hostname(),
            port: port,
            nodeCount: data.length,
            timeout: timeoutMS,
            ip: req.ip,
        });
    }, timeoutMS);
};
pubsub.on('sync:node:info:start', () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const data = yield getNodeInfo();
        data.id = `${os.hostname()}:${nconf_1.default.get('port')}`;
        pubsub.publish('sync:node:info:end', { data: data, id: data.id });
    }
    catch (err) {
        winston_1.default.error(err.stack);
    }
}));
pubsub.on('sync:node:info:end', (data) => {
    info[data.id] = data.data;
});
function getNodeInfo() {
    return __awaiter(this, void 0, void 0, function* () {
        const data = {
            process: {
                port: nconf_1.default.get('port'),
                pid: process.pid,
                title: process.title,
                version: process.version,
                memoryUsage: process.memoryUsage(),
                uptime: process.uptime(),
                cpuUsage: getCpuUsage(),
            },
            os: {
                hostname: os.hostname(),
                type: os.type(),
                platform: os.platform(),
                arch: os.arch(),
                release: os.release(),
                load: os.loadavg().map((load) => load.toFixed(2)).join(', '),
                freemem: os.freemem(),
                totalmem: os.totalmem(),
            },
            nodebb: {
                isCluster: nconf_1.default.get('isCluster'),
                isPrimary: nconf_1.default.get('isPrimary'),
                runJobs: nconf_1.default.get('runJobs'),
                jobsDisabled: nconf_1.default.get('jobsDisabled'),
            },
        };
        data.process.memoryUsage.humanReadable = (data.process.memoryUsage.rss / (1024 * 1024 * 1024)).toFixed(3);
        data.process.uptimeHumanReadable = humanReadableUptime(data.process.uptime);
        data.os.freemem = (data.os.freemem / (1024 * 1024 * 1024)).toFixed(2);
        data.os.totalmem = (data.os.totalmem / (1024 * 1024 * 1024)).toFixed(2);
        data.os.usedmem = (data.os.totalmem - data.os.freemem).toFixed(2);
        const [stats, gitInfo] = yield Promise.all([
            rooms.getLocalStats(),
            getGitInfo(),
        ]);
        data.git = gitInfo;
        data.stats = stats;
        return data;
    });
}
function getCpuUsage() {
    const newUsage = process.cpuUsage();
    const diff = (newUsage.user + newUsage.system) - (previousUsage.user + previousUsage.system);
    const now = Date.now();
    const result = diff / ((now - usageStartDate) * 1000) * 100;
    previousUsage = newUsage;
    usageStartDate = now;
    return result.toFixed(2);
}
function humanReadableUptime(seconds) {
    if (seconds < 60) {
        return `${Math.floor(seconds)}s`;
    }
    else if (seconds < 3600) {
        return `${Math.floor(seconds / 60)}m`;
    }
    else if (seconds < 3600 * 24) {
        return `${Math.floor(seconds / (60 * 60))}h`;
    }
    return `${Math.floor(seconds / (60 * 60 * 24))}d`;
}
function getGitInfo() {
    return __awaiter(this, void 0, void 0, function* () {
        function get(cmd, callback) {
            exec(cmd, (err, stdout) => {
                if (err) {
                    winston_1.default.error(err.stack);
                }
                callback && callback(null, stdout ? stdout.replace(/\n$/, '') : 'no-git-info');
            });
        }
        const getAsync = require('util').promisify(get);
        const [hash, branch] = yield Promise.all([
            getAsync('git rev-parse HEAD'),
            getAsync('git rev-parse --abbrev-ref HEAD'),
        ]);
        return { hash: hash, hashShort: hash.slice(0, 6), branch: branch };
    });
}
