import winston from 'winston';
import { DateTime } from 'luxon';
import Transport from 'winston-transport';

class LoggerRecorder extends Transport {
    isRecording = false;
    recorded = [];
    constructor(opts) {
        super(opts);
    }
    log(info, callback) {
        setImmediate(() => {
            this.emit('logged', info);
        });
        if (this.isRecording) {
            this.recorded.push(info);
        } else {
            console.log(info[Symbol.for('message')]);
        }
        callback();
    }
    startRecording() {
        this.isRecording = true;
    }
    stopRecording() {
        this.isRecording = false;
        for (const info of this.recorded) {
            console.log(info[Symbol.for('message')]);
        }
        this.recorded = [];
    }
}

class LoggerWithIndentation {
    recorder = new LoggerRecorder();
    constructor() {
        /**
         * @type {Map<number, import('winston').Logger>}
         */
        this.loggers = new Map();
    }

    createLogger(indent) {
        const indentString = '\t'.repeat(indent);
        const tabFormat = winston.format.printf(({ level, message, timestamp, ...meta }) => {
            let metaString = '';
            if (Object.keys(meta).length > 0) {
                const transformedMeta = transformErrorMeta(meta);
                const indentStringJson = `\n${indentString}`;
                metaString = `${indentStringJson}${JSON.stringify(transformedMeta, null, 2).replace(/\n/g, `${indentStringJson}`)}`;
            }
            return `${indentString}${timestamp} [${level}] ${message}${metaString}`;
        });

        const formats = [
            winston.format.timestamp({
                format: () => DateTime.now().toISO(),
            }),
            winston.format.errors({ stack: true }),
            winston.format.splat(),
            tabFormat,
        ];

        if (process.stdout.isTTY) {
            formats.unshift(winston.format.colorize());
        }

        return winston.createLogger({
            format: winston.format.combine(...formats),
            // transports: [new winston.transports.Console()],
            transports: [this.recorder],
        });
    }

    getLogger(indent) {
        let logger = this.loggers.get(indent);
        if (!logger) {
            logger = this.createLogger(indent);
            this.loggers.set(indent, logger);
        }
        return logger;
    }
}

function transformErrorMeta(meta) {
    if (meta instanceof Error) {
        const errorObj = {
            message: meta.message || '[No error message]',
            // Split stack into an array of lines for readable JSON output
            stack: meta.stack ? meta.stack.split('\n') : ['[No stack trace]'],
            name: meta.name || 'Error',
        };
        // Include any additional enumerable properties
        Object.getOwnPropertyNames(meta).forEach((key) => {
            if (!(key in errorObj)) {
                errorObj[key] = transformErrorMeta(meta[key]);
            }
        });
        return errorObj;
    }
    if (typeof meta !== 'object' || meta === null) {
        return meta;
    }
    const result = Array.isArray(meta) ? [] : {};
    for (const [key, value] of Object.entries(meta)) {
        result[key] = transformErrorMeta(value);
    }
    return result;
}

export default LoggerWithIndentation;