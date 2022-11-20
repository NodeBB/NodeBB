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
/*
 * Logger module: ability to dynamically turn on/off logging for http requests & socket.io events
 */
const fs = __importStar(require("fs"));
const path_1 = __importDefault(require("path"));
const winston_1 = __importDefault(require("winston"));
const util = require('util');
const morgan = require('morgan');
const file = require('./file');
const meta = require('./meta');
const opts = {
    /*
     * state used by Logger
     */
    express: {
        app: {},
        set: 0,
        ofn: null,
    },
    streams: {
        log: { f: process.stdout },
    },
};
/* -- Logger -- */
const Logger = {};
Logger.init = function (app) {
    opts.express.app = app;
    /* Open log file stream & initialize express logging if meta.config.logger* variables are set */
    Logger.setup();
};
Logger.setup = function () {
    Logger.setup_one('loggerPath', meta.config.loggerPath);
};
Logger.setup_one = function (key, value) {
    /*
     * 1. Open the logger stream: stdout or file
     * 2. Re-initialize the express logger hijack
     */
    if (key === 'loggerPath') {
        Logger.setup_one_log(value);
        Logger.express_open();
    }
};
Logger.setup_one_log = function (value) {
    /*
     * If logging is currently enabled, create a stream.
     * Otherwise, close the current stream
     */
    if (meta.config.loggerStatus > 0 || meta.config.loggerIOStatus) {
        const stream = Logger.open(value);
        if (stream) {
            opts.streams.log.f = stream;
        }
        else {
            opts.streams.log.f = process.stdout;
        }
    }
    else {
        Logger.close(opts.streams.log);
    }
};
Logger.open = function (value) {
    /* Open the streams to log to: either a path or stdout */
    let stream;
    if (value) {
        if (file.existsSync(value)) {
            const stats = fs.statSync(value);
            if (stats) {
                if (stats.isDirectory()) {
                    stream = fs.createWriteStream(path_1.default.join(value, 'nodebb.log'), { flags: 'a' });
                }
                else {
                    stream = fs.createWriteStream(value, { flags: 'a' });
                }
            }
        }
        else {
            stream = fs.createWriteStream(value, { flags: 'a' });
        }
        if (stream) {
            stream.on('error', (err) => {
                winston_1.default.error(err.stack);
            });
        }
    }
    else {
        stream = process.stdout;
    }
    return stream;
};
Logger.close = function (stream) {
    if (stream.f !== process.stdout && stream.f) {
        stream.end();
    }
    stream.f = null;
};
Logger.monitorConfig = function (socket, data) {
    /*
     * This monitor's when a user clicks "save" in the Logger section of the admin panel
     */
    Logger.setup_one(data.key, data.value);
    Logger.io_close(socket);
    Logger.io(socket);
};
Logger.express_open = function () {
    if (opts.express.set !== 1) {
        opts.express.set = 1;
        opts.express.app.use(Logger.expressLogger);
    }
    /*
     * Always initialize "ofn" (original function) with the original logger function
     */
    opts.express.ofn = morgan('combined', { stream: opts.streams.log.f });
};
Logger.expressLogger = function (req, res, next) {
    /*
     * The new express.logger
     *
     * This hijack allows us to turn logger on/off dynamically within express
     */
    if (meta.config.loggerStatus > 0) {
        return opts.express.ofn(req, res, next);
    }
    return next();
};
Logger.prepare_io_string = function (_type, _uid, _args) {
    /*
     * This prepares the output string for intercepted socket.io events
     *
     * The format is: io: <uid> <event> <args>
     */
    try {
        return `io: ${_uid} ${_type} ${util.inspect(Array.prototype.slice.call(_args), { depth: 3 })}\n`;
    }
    catch (err) {
        winston_1.default.info('Logger.prepare_io_string: Failed', err);
        return 'error';
    }
};
Logger.io_close = function (socket) {
    /*
     * Restore all hijacked sockets to their original emit/on functions
     */
    if (!socket || !socket.io || !socket.io.sockets || !socket.io.sockets.sockets) {
        return;
    }
    const clientsMap = socket.io.sockets.sockets;
    for (const [, client] of clientsMap) {
        if (client.oEmit && client.oEmit !== client.emit) {
            client.emit = client.oEmit;
        }
        if (client.$onevent && client.$onevent !== client.onevent) {
            client.onevent = client.$onevent;
        }
    }
};
Logger.io = function (socket) {
    /*
     * Go through all of the currently established sockets & hook their .emit/.on
     */
    if (!socket || !socket.io || !socket.io.sockets || !socket.io.sockets.sockets) {
        return;
    }
    const clientsMap = socket.io.sockets.sockets;
    for (const [, socketObj] of clientsMap) {
        Logger.io_one(socketObj, socketObj.uid);
    }
};
Logger.io_one = function (socket, uid) {
    /*
     * This function replaces a socket's .emit/.on functions in order to intercept events
     */
    function override(method, name, errorMsg) {
        return (...args) => {
            if (opts.streams.log.f) {
                opts.streams.log.f.write(Logger.prepare_io_string(name, uid, args));
            }
            try {
                method.apply(socket, args);
            }
            catch (err) {
                winston_1.default.info(errorMsg, err);
            }
        };
    }
    if (socket && meta.config.loggerIOStatus > 0) {
        // courtesy of: http://stackoverflow.com/a/9674248
        socket.oEmit = socket.emit;
        const { emit } = socket;
        socket.emit = override(emit, 'emit', 'Logger.io_one: emit.apply: Failed');
        socket.$onvent = socket.onevent;
        const $onevent = socket.onevent;
        socket.onevent = override($onevent, 'on', 'Logger.io_one: $emit.apply: Failed');
    }
};
