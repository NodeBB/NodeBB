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
exports.testSocket = exports.listen = exports.destroy = void 0;
const fs = __importStar(require("fs"));
const util = require('util');
const path_1 = __importDefault(require("path"));
const os = require('os');
const nconf_1 = __importDefault(require("nconf"));
const express = require('express');
const chalk = require('chalk');
const app = express();
app.renderAsync = util.promisify((tpl, data, callback) => app.render(tpl, data, callback));
let server;
const winston_1 = __importDefault(require("winston"));
const flash = require('connect-flash');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const useragent = require('express-useragent');
const favicon = require('serve-favicon');
const detector = require('spider-detector');
const helmet = require('helmet');
const Benchpress = require('benchpressjs');
const database = __importStar(require("./database"));
const db = database;
const analytics = require('./analytics');
const file = require('./file');
const emailer = require('./emailer');
const meta = require('./meta');
const logger = require('./logger');
const plugins = require('./plugins');
const flags = require('./flags');
const topicEvents = require('./topics/events');
const privileges = require('./privileges');
const routes = require('./routes');
const auth = require('./routes/authentication');
const helpers = require('./helpers').defualt;
if (nconf_1.default.get('ssl')) {
    server = require('https').createServer({
        key: fs.readFileSync(nconf_1.default.get('ssl').key),
        cert: fs.readFileSync(nconf_1.default.get('ssl').cert),
    }, app);
}
else {
    server = require('http').createServer(app);
}
server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        winston_1.default.error(`NodeBB address in use, exiting...\n${err.stack}`);
    }
    else {
        winston_1.default.error(err.stack);
    }
    throw err;
});
// see https://github.com/isaacs/server-destroy/blob/master/index.js
const connections = {};
server.on('connection', (conn) => {
    const key = `${conn.remoteAddress}:${conn.remotePort}`;
    connections[key] = conn;
    conn.on('close', () => {
        delete connections[key];
    });
});
const destroy = function (callback) {
    server.close(callback);
    for (const connection of Object.values(connections)) {
        connection.destroy();
    }
};
exports.destroy = destroy;
// @ts-ignore
const listen = function () {
    return __awaiter(this, void 0, void 0, function* () {
        emailer.registerApp(app);
        setupExpressApp(app);
        helpers.register();
        logger.init(app);
        yield initializeNodeBB();
        winston_1.default.info('🎉 NodeBB Ready');
        require('./socket.io').server.emit('event:nodebb.ready', {
            'cache-buster': meta.config['cache-buster'],
            hostname: os.hostname(),
        });
        plugins.hooks.fire('action:nodebb.ready');
        yield listen2();
    });
};
exports.listen = listen;
function initializeNodeBB() {
    return __awaiter(this, void 0, void 0, function* () {
        const middleware = require('./middleware');
        yield meta.themes.setupPaths();
        yield plugins.init(app, middleware);
        yield plugins.hooks.fire('static:assets.prepare', {});
        yield plugins.hooks.fire('static:app.preload', {
            app: app,
            middleware: middleware,
        });
        yield routes(app, middleware);
        yield privileges.init();
        yield meta.blacklist.load();
        yield flags.init();
        yield analytics.init();
        yield topicEvents.init();
    });
}
function setupExpressApp(app) {
    const middleware = require('./middleware');
    const pingController = require('./controllers/ping');
    const relativePath = nconf_1.default.get('relative_path');
    const viewsDir = nconf_1.default.get('views_dir');
    app.engine('tpl', (filepath, data, next) => {
        filepath = filepath.replace(/\.tpl$/, '.js');
        Benchpress.__express(filepath, data, next);
    });
    app.set('view engine', 'tpl');
    app.set('views', viewsDir);
    app.set('json spaces', global.env === 'development' ? 4 : 0);
    app.use(flash());
    app.enable('view cache');
    if (global.env !== 'development') {
        app.enable('cache');
        app.enable('minification');
    }
    if (meta.config.useCompression) {
        const compression = require('compression');
        app.use(compression());
    }
    if (relativePath) {
        app.use((req, res, next) => {
            if (!req.path.startsWith(relativePath)) {
                return require('./controllers/helpers').redirect(res, req.path);
            }
            next();
        });
    }
    app.get(`${relativePath}/ping`, pingController.ping);
    app.get(`${relativePath}/sping`, pingController.ping);
    setupFavicon(app);
    app.use(`${relativePath}/apple-touch-icon`, middleware.routeTouchIcon);
    configureBodyParser(app);
    app.use(cookieParser(nconf_1.default.get('secret')));
    app.use(useragent.express());
    app.use(detector.middleware());
    app.use(session({
        store: db.sessionStore,
        secret: nconf_1.default.get('secret'),
        key: nconf_1.default.get('sessionKey'),
        cookie: setupCookie(),
        resave: nconf_1.default.get('sessionResave') || false,
        saveUninitialized: nconf_1.default.get('sessionSaveUninitialized') || false,
    }));
    setupHelmet(app);
    app.use(middleware.addHeaders);
    app.use(middleware.processRender);
    auth.initialize(app, middleware);
    const als = require('./als');
    app.use((req, res, next) => {
        als.run({ uid: req.uid }, next);
    });
    app.use(middleware.autoLocale); // must be added after auth middlewares are added
    const toobusy = require('toobusy-js');
    toobusy.maxLag(meta.config.eventLoopLagThreshold);
    toobusy.interval(meta.config.eventLoopInterval);
}
function setupHelmet(app) {
    const options = {
        contentSecurityPolicy: false,
        crossOriginOpenerPolicy: { policy: meta.config['cross-origin-opener-policy'] },
        crossOriginResourcePolicy: { policy: meta.config['cross-origin-resource-policy'] },
        referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    };
    if (!meta.config['cross-origin-embedder-policy']) {
        options.crossOriginEmbedderPolicy = false;
    }
    if (meta.config['hsts-enabled']) {
        options.hsts = {
            maxAge: meta.config['hsts-maxage'],
            includeSubDomains: !!meta.config['hsts-subdomains'],
            preload: !!meta.config['hsts-preload'],
        };
    }
    app.use(helmet(options));
}
function setupFavicon(app) {
    let faviconPath = meta.config['brand:favicon'] || 'favicon.ico';
    faviconPath = path_1.default.join(nconf_1.default.get('base_dir'), 'public', faviconPath.replace(/assets\/uploads/, 'uploads'));
    if (file.existsSync(faviconPath)) {
        app.use(nconf_1.default.get('relative_path'), favicon(faviconPath));
    }
}
function configureBodyParser(app) {
    const urlencodedOpts = nconf_1.default.get('bodyParser:urlencoded') || {};
    if (!urlencodedOpts.hasOwnProperty('extended')) {
        urlencodedOpts.extended = true;
    }
    app.use(bodyParser.urlencoded(urlencodedOpts));
    const jsonOpts = nconf_1.default.get('bodyParser:json') || {};
    app.use(bodyParser.json(jsonOpts));
}
function setupCookie() {
    const cookie = meta.configs.cookie.get();
    const ttl = meta.getSessionTTLSeconds() * 1000;
    cookie.maxAge = ttl;
    return cookie;
}
// @ts-ignore
function listen2() {
    return __awaiter(this, void 0, void 0, function* () {
        let port = nconf_1.default.get('port');
        const isSocket = isNaN(port) && !Array.isArray(port);
        const socketPath = isSocket ? nconf_1.default.get('port') : '';
        if (Array.isArray(port)) {
            if (!port.length) {
                winston_1.default.error('[startup] empty ports array in config.json');
                process.exit();
            }
            winston_1.default.warn('[startup] If you want to start nodebb on multiple ports please use loader.js');
            winston_1.default.warn(`[startup] Defaulting to first port in array, ${port[0]}`);
            port = port[0];
            if (!port) {
                winston_1.default.error('[startup] Invalid port, exiting');
                process.exit();
            }
        }
        port = parseInt(port, 10);
        if ((port !== 80 && port !== 443) || nconf_1.default.get('trust_proxy') === true) {
            winston_1.default.info('🤝 Enabling \'trust proxy\'');
            app.enable('trust proxy');
        }
        if ((port === 80 || port === 443) && process.env.NODE_ENV !== 'development') {
            winston_1.default.info('Using ports 80 and 443 is not recommend; use a proxy instead. See README.md');
        }
        const bind_address = ((nconf_1.default.get('bind_address') === '0.0.0.0' || !nconf_1.default.get('bind_address')) ? '0.0.0.0' : nconf_1.default.get('bind_address'));
        const args = isSocket ? [socketPath] : [port, bind_address];
        let oldUmask;
        if (isSocket) {
            oldUmask = process.umask('0000');
            try {
                yield (0, exports.testSocket)(socketPath);
            }
            catch (err) {
                winston_1.default.error(`[startup] NodeBB was unable to secure domain socket access (${socketPath})\n${err.stack}`);
                throw err;
            }
        }
        return new Promise((resolve, reject) => {
            server.listen(...args.concat([function (err) {
                    const onText = `${isSocket ? socketPath : `${bind_address}:${port}`}`;
                    if (err) {
                        winston_1.default.error(`[startup] NodeBB was unable to listen on: ${chalk.yellow(onText)}`);
                        reject(err);
                    }
                    winston_1.default.info(`📡 NodeBB is now listening on: ${chalk.yellow(onText)}`);
                    winston_1.default.info(`🔗 Canonical URL: ${chalk.yellow(nconf_1.default.get('url'))}`);
                    if (oldUmask) {
                        process.umask(oldUmask);
                    }
                    resolve();
                }]));
        });
    });
}
const testSocket = function (socketPath) {
    return __awaiter(this, void 0, void 0, function* () {
        if (typeof socketPath !== 'string') {
            throw new Error(`invalid socket path : ${socketPath}`);
        }
        const net = require('net');
        const file = require('./file');
        const exists = yield file.exists(socketPath);
        if (!exists) {
            return;
        }
        return new Promise((resolve, reject) => {
            const testSocket = new net.Socket();
            testSocket.on('error', (err) => {
                if (err.code !== 'ECONNREFUSED') {
                    return reject(err);
                }
                // The socket was stale, kick it out of the way
                fs.unlink(socketPath, (err) => {
                    if (err)
                        reject(err);
                    else
                        resolve();
                });
            });
            testSocket.connect({ path: socketPath }, () => {
                // Something's listening here, abort
                reject(new Error('port-in-use'));
            });
        });
    });
};
exports.testSocket = testSocket;
require('./promisify').promisify(exports);
