import LoggerWithIndentation from './LoggerWithIndentation.mjs';

class PromiseInfo {
    /**
     * Represents information about a promise and its origin.
     * @param {Promise<any>} promise - The promise to track.
     * @param {string} file - The file where the promise was registered.
     * @param {string} line - The line number in the file.
     * @param {string} column - The column number in the file.
     * @param {number} registerTime - The time when the promise was registered.
     */
    constructor(promise, file, line, column, registerTime) {
        /** @type {Promise<any>} */
        this.promise = promise;

        /** @type {string} */
        this.location = `${file}:${line}:${column}`;

        /** @type {number} */
        this.registerTime = registerTime;
    }
}

/** @type {PromiseInfo[]} */
const promises = [];
let lastCallRegister = Date.now();

/**
 * @param {Promise<any>} promise 
 */
export default function registerAsyncDynamicTestCreation(promise) {
    // Parse stack to get the calling file, line, and position
    const stackLines = new Error().stack.split('\n');
    let callingFile = 'unknown';
    let lineNumber = '';
    let columnNumber = '';

    // Look for the line after registerAsyncDynamicTestCreation
    for (let i = 1; i < stackLines.length; i++) {
        if (stackLines[i].includes('registerAsyncDynamicTestCreation')) {
            // Next line is the caller
            if (stackLines[i + 1]) {
                // Extract file path and line/column (handles both file:/// and regular paths)
                const match = stackLines[i + 1].match(/(file:\/\/\/[^:]+|\/[^:]+):(\d+):(\d+)/);
                if (match) {
                    callingFile = match[1]; // File path
                    callingFile = callingFile.replace(/^file:\/\//, '');
                    lineNumber = match[2];  // Line number
                    columnNumber = match[3]; // Column number
                }
            }
            break;
        }
    }

    lastCallRegister = Date.now();

    // Check if the promise is already in the array
    if (promises.includes(promise)) {
        console.warn('Promise already registered:', promise);
        return;
    }

    // Register the promise
    promises.push(new PromiseInfo(promise, callingFile, lineNumber, columnNumber, lastCallRegister));
}

(async () => {
    while (Date.now() - lastCallRegister < 1000) {
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    await Promise.all(promises.map(p => p.promise));
    const logger = new LoggerWithIndentation();
    const log = (level) => logger.getLogger(level);
    log(0).info('All promises resolved', promises);
    setImmediate(run);
})().catch(err => {
    console.log(err);
});