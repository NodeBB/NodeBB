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
const nconf_1 = __importDefault(require("nconf"));
const winston_1 = __importDefault(require("winston"));
const start = {};
start.start = function () {
    return __awaiter(this, void 0, void 0, function* () {
        printStartupInfo();
        addProcessHandlers();
        try {
            const db = require('./database').default;
            yield db.init();
            yield db.checkCompatibility();
            const meta = require('./meta').default;
            yield meta.config.init();
            if (nconf_1.default.get('runJobs')) {
                yield runUpgrades();
            }
            if (nconf_1.default.get('dep-check') === undefined || nconf_1.default.get('dep-check') !== false) {
                yield meta.dependencies.check();
            }
            else {
                winston_1.default.warn('[init] Dependency checking skipped!');
            }
            yield db.initSessionStore();
            const webserver = require('./webserver').default;
            const sockets = require('./socket.io').default;
            yield sockets.init(webserver.server);
            if (nconf_1.default.get('runJobs')) {
                require('./notifications').default.startJobs();
                require('./user').default.startJobs();
                require('./plugins').default.startJobs();
                require('./topics').default.scheduled.startJobs();
                yield db.delete('locks');
            }
            yield webserver.listen();
            if (process.send) {
                process.send({
                    action: 'listening',
                });
            }
        }
        catch (err) {
            switch (err.message) {
                case 'dependencies-out-of-date':
                    winston_1.default.error('One or more of NodeBB\'s dependent packages are out-of-date. Please run the following command to update them:');
                    winston_1.default.error('    ./nodebb upgrade');
                    break;
                case 'dependencies-missing':
                    winston_1.default.error('One or more of NodeBB\'s dependent packages are missing. Please run the following command to update them:');
                    winston_1.default.error('    ./nodebb upgrade');
                    break;
                default:
                    winston_1.default.error(err.stack);
                    break;
            }
            // Either way, bad stuff happened. Abort start.
            process.exit();
        }
    });
};
function runUpgrades() {
    return __awaiter(this, void 0, void 0, function* () {
        const upgrade = require('./upgrade').default;
        try {
            yield upgrade.check();
        }
        catch (err) {
            if (err && err.message === 'schema-out-of-date') {
                yield upgrade.run();
            }
            else {
                throw err;
            }
        }
    });
}
function printStartupInfo() {
    if (nconf_1.default.get('isPrimary')) {
        winston_1.default.info('Initializing NodeBB v%s %s', nconf_1.default.get('version'), nconf_1.default.get('url'));
        const host = nconf_1.default.get(`${nconf_1.default.get('database')}:host`);
        const storeLocation = host ? `at ${host}${!host.includes('/') ? `:${nconf_1.default.get(`${nconf_1.default.get('database')}:port`)}` : ''}` : '';
        winston_1.default.verbose('* using %s store %s', nconf_1.default.get('database'), storeLocation);
        winston_1.default.verbose('* using themes stored in: %s', nconf_1.default.get('themes_path'));
    }
}
function addProcessHandlers() {
    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
    process.on('SIGHUP', restart);
    process.on('uncaughtException', (err) => {
        winston_1.default.error(err.stack);
        require('./meta').js.killMinifier();
        shutdown(1);
    });
    process.on('message', (msg) => {
        if (msg && Array.isArray(msg.compiling)) {
            if (msg.compiling.includes('tpl')) {
                const benchpressjs = require('benchpressjs');
                benchpressjs.flush();
            }
            else if (msg.compiling.includes('lang')) {
                const translator = require('./translator');
                translator.flush();
            }
        }
    });
}
function restart() {
    if (process.send) {
        winston_1.default.info('[app] Restarting...');
        process.send({
            action: 'restart',
        });
    }
    else {
        winston_1.default.error('[app] Could not restart server. Shutting down.');
        shutdown(1);
    }
}
function shutdown(code) {
    return __awaiter(this, void 0, void 0, function* () {
        winston_1.default.info('[app] Shutdown (SIGTERM/SIGINT) Initialised.');
        try {
            yield require('./webserver').destroy();
            winston_1.default.info('[app] Web server closed to connections.');
            yield require('./analytics').writeData();
            winston_1.default.info('[app] Live analytics saved.');
            yield require('./database').default.close();
            winston_1.default.info('[app] Database connection closed.');
            winston_1.default.info('[app] Shutdown complete.');
            process.exit(code || 0);
        }
        catch (err) {
            winston_1.default.error(err.stack);
            return process.exit(code || 0);
        }
    });
}
exports.default = start;
