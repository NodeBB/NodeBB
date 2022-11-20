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
Object.defineProperty(exports, "__esModule", { value: true });
exports.processArray = exports.processSortedSet = void 0;
const util = require('util');
const db = require('./database');
const utils = require('./utils');
const DEFAULT_BATCH_SIZE = 100;
const sleep = util.promisify(setTimeout);
const processSortedSet = function (setKey, process, options) {
    return __awaiter(this, void 0, void 0, function* () {
        options = options || {};
        if (typeof process !== 'function') {
            throw new Error('[[error:process-not-a-function]]');
        }
        // Progress bar handling (upgrade scripts)
        if (options.progress) {
            options.progress.total = yield db.sortedSetCard(setKey);
        }
        options.batch = options.batch || DEFAULT_BATCH_SIZE;
        // use the fast path if possible
        if (db.processSortedSet && typeof options.doneIf !== 'function' && !utils.isNumber(options.alwaysStartAt)) {
            return yield db.processSortedSet(setKey, process, options);
        }
        // custom done condition
        options.doneIf = typeof options.doneIf === 'function' ? options.doneIf : function () { };
        let start = 0;
        let stop = options.batch - 1;
        if (process && process.constructor && process.constructor.name !== 'AsyncFunction') {
            process = util.promisify(process);
        }
        while (true) {
            /* eslint-disable no-await-in-loop */
            const ids = yield db[`getSortedSetRange${options.withScores ? 'WithScores' : ''}`](setKey, start, stop);
            if (!ids.length || options.doneIf(start, stop, ids)) {
                return;
            }
            yield process(ids);
            start += utils.isNumber(options.alwaysStartAt) ? options.alwaysStartAt : options.batch;
            stop = start + options.batch - 1;
            if (options.interval) {
                yield sleep(options.interval);
            }
        }
    });
};
exports.processSortedSet = processSortedSet;
const processArray = function (array, process, options) {
    return __awaiter(this, void 0, void 0, function* () {
        options = options || {};
        if (!Array.isArray(array) || !array.length) {
            return;
        }
        if (typeof process !== 'function') {
            throw new Error('[[error:process-not-a-function]]');
        }
        const batch = options.batch || DEFAULT_BATCH_SIZE;
        let start = 0;
        if (process && process.constructor && process.constructor.name !== 'AsyncFunction') {
            process = util.promisify(process);
        }
        while (true) {
            const currentBatch = array.slice(start, start + batch);
            if (!currentBatch.length) {
                return;
            }
            yield process(currentBatch);
            start += batch;
            if (options.interval) {
                yield sleep(options.interval);
            }
        }
    });
};
exports.processArray = processArray;
console.log('REQUIRE PROMISIFY', require('./promisify'));
require('./promisify').promisify(exports);
