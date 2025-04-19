'use strict';

/**
 * monkey patch for mocha because it doesn't fully support async dynamic test creation in CommonJS
 * so we need to
 * - wait for all async test creation tasks to finish in a test file before loading the next test file
 * - wait for all async test creation tasks to finish before running the tests
 * 
 * Ensure Mocha uses this override by importing it early.
 * 
 * TRY TO USE ECMAScript Modules (ESM) INSTEAD OF CommonJS. IT IS MUCH EASIER TO WORK WITH.
 * Because ESM has "top-level await".
 */

import mochaEsmUtils from 'mocha/lib/nodejs/esm-utils.js';
import { promises } from './registerTestFile.mjs';
import LoggerWithIndentation from './LoggerWithIndentation.mjs';

const logger = new LoggerWithIndentation();
const log = (level) => logger.getLogger(level);

// Override requireOrImport
const originalRequireOrImport = mochaEsmUtils.requireOrImport;
mochaEsmUtils.requireOrImport = async function (...args) {
    const result = await originalRequireOrImport.apply(this, args);

    const pendingPromises = promises.filter(p => p.isPending !== false);
    if (pendingPromises.length > 0) {
        log(1).info('Waiting for pending promises to resolve:', pendingPromises);
        await Promise.all(promises.map(p => p.promise));
    }

    return result;
};

// Override loadFilesAsync
const originalLoadFilesAsync = mochaEsmUtils.loadFilesAsync;
mochaEsmUtils.loadFilesAsync = async function (...args) {
    log(0).info('loadFilesAsync started');

    const result = await originalLoadFilesAsync.apply(this, args);
    log(0).info('loadFilesAsync completed successfully');

    await Promise.all(promises.map(p => p.promise));
    log(0).info('All promises resolved', promises);
    setImmediate(run);

    return result;
};
