import winston from 'winston';
import { DateTime } from 'luxon';
import Transport from 'winston-transport';
import util from 'util';

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
    constructor(indentWidth = 2) {
        /** @type {Map<number, import('winston').Logger>} */
        this.loggers = new Map();

        /** @type {number} */
        this.indentWidth = indentWidth;
    }

    createLogger(indent) {
        const colorTimestamp = winston.format((info) => {
            if (process.stdout.isTTY) {
                info.timestamp = `\x1b[${util.inspect.colors.cyan[0]}m${info.timestamp}\x1b[${util.inspect.colors.cyan[1]}m`;
            }
            return info;
        });

        const customSplat = winston.format((info) => {
            const { level, message, timestamp, ...meta } = info;

            if (meta[Symbol.for('splat')] === undefined) {
                info.formattedMessage = message;
            } else if (meta[Symbol.for('splat')] === null) {
                info.formattedMessage = message;
            }
            else if (meta[Symbol.for('splat')].length === 0) {
                info.formattedMessage = message;
            } else
                info.formattedMessage = util.formatWithOptions({ colors: process.stdout.isTTY }, message, ...meta[Symbol.for('splat')]);
            return info;
        });

        const tabFormat = winston.format.printf(({ level, formattedMessage, timestamp, ...meta }) => {
            const indentString = ' '.repeat(this.indentWidth).repeat(indent);
            const resultWithoutIndent = `${timestamp} [${level}] ${formattedMessage}`;
            const resultWithIndent = resultWithoutIndent.replace(/\n/g, `\n${indentString}`);
            return `${indentString}${resultWithIndent}`;
        });

        const formats = [
            winston.format.timestamp({
                format: () => DateTime.now().toISO(),
            }),
            colorTimestamp(),
            customSplat(),
            tabFormat,
        ];

        if (process.stdout.isTTY) {
            formats.unshift(winston.format.colorize());
        }

        return winston.createLogger({
            format: winston.format.combine(...formats),
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

export default LoggerWithIndentation;