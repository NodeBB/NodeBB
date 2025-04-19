/**
 * This module tracks promises created during the execution of a test file.
 */

'use strict';

import LoggerWithIndentation from './LoggerWithIndentation.mjs';
import { DateTime } from 'luxon';
import stackTrace from 'stack-trace';
import path from 'path';
import { fileURLToPath } from 'url';

class PromiseInfo {
    /**
     * Represents information about a promise and its origin.
     * @param {Promise<any>} promise - The promise to track.
     * @param {string} file - The file where the promise was registered.
     * @param {string} line - The line number in the file.
     * @param {string} column - The column number in the file.
     * @param {string} registerTime - The time when the promise was registered.
     */
    constructor(promise, file, line, column, registerTime) {
        /** @type {Promise<any>} */
        this.promise = promise;

        /** @type {string} */
        this.location = `${file}:${line}:${column}`;

        /** @type {string} */
        this.registerTime = registerTime;

        /** @type {boolean} */
        this.isPending = true;
        this.promise.finally(() => {
            this.isPending = false;
        });
    }
}

/** @type {PromiseInfo[]} */
export const promises = [];

const logger = new LoggerWithIndentation();
const log = (level) => logger.getLogger(level);

/**
 * @param {Promise<any>} promise 
 */
export default function registerAsyncDynamicTestCreation(promise) {
    // Get stack trace
    const trace = stackTrace.get();

    let callingFile = 'unknown';
    let lineNumber = '';
    let columnNumber = '';

    for (let i = 0; i < trace.length; i++) {
        if (!trace[i].getFunctionName()?.includes('registerAsyncDynamicTestCreation')) {
            continue;
        }
        // Next frame is the caller
        if (!trace[i + 1]) {
            break;
        }
        let rawFile = trace[i + 1].getFileName() || 'unknown';
        // Handle file:// URLs and convert to canonical path
        if (rawFile.startsWith('file://')) {
            rawFile = fileURLToPath(rawFile); // Convert file:// URL to path
        }
        // Normalize and resolve to canonical path
        callingFile = path.resolve(path.normalize(rawFile));
        lineNumber = trace[i + 1].getLineNumber();
        columnNumber = trace[i + 1].getColumnNumber();
        break;
    }

    // Register the promise
    promises.push(new PromiseInfo(promise, callingFile, lineNumber, columnNumber, DateTime.now().toISO()));
};
