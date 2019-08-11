
'use strict';

const util = require('util');

var db = require('./database');
var utils = require('./utils');

var DEFAULT_BATCH_SIZE = 100;

const sleep = util.promisify(setTimeout);

exports.processSortedSet = async function (setKey, process, options) {
	options = options || {};

	if (typeof process !== 'function') {
		throw new Error('[[error:process-not-a-function]]');
	}

	// Progress bar handling (upgrade scripts)
	if (options.progress) {
		options.progress.total = await db.sortedSetCard(setKey);
	}

	options.batch = options.batch || DEFAULT_BATCH_SIZE;

	// use the fast path if possible
	if (db.processSortedSet && typeof options.doneIf !== 'function' && !utils.isNumber(options.alwaysStartAt)) {
		return await db.processSortedSet(setKey, process, options);
	}

	// custom done condition
	options.doneIf = typeof options.doneIf === 'function' ? options.doneIf : function () {};

	var start = 0;
	var stop = options.batch;

	if (process && process.constructor && process.constructor.name !== 'AsyncFunction') {
		process = util.promisify(process);
	}

	while (true) {
		/* eslint-disable no-await-in-loop */
		const ids = await db['getSortedSetRange' + (options.withScores ? 'WithScores' : '')](setKey, start, stop);
		if (!ids.length || options.doneIf(start, stop, ids)) {
			return;
		}
		await process(ids);

		start += utils.isNumber(options.alwaysStartAt) ? options.alwaysStartAt : options.batch + 1;
		stop = start + options.batch;

		if (options.interval) {
			await sleep(options.interval);
		}
	}
};

exports.processArray = async function (array, process, options) {
	options = options || {};

	if (!Array.isArray(array) || !array.length) {
		return;
	}
	if (typeof process !== 'function') {
		throw new Error('[[error:process-not-a-function]]');
	}

	var batch = options.batch || DEFAULT_BATCH_SIZE;
	var start = 0;
	if (process && process.constructor && process.constructor.name !== 'AsyncFunction') {
		process = util.promisify(process);
	}

	while (true) {
		var currentBatch = array.slice(start, start + batch);

		if (!currentBatch.length) {
			return;
		}

		await process(currentBatch);

		start += batch;

		if (options.interval) {
			await sleep(options.interval);
		}
	}
};
require('./promisify')(exports);
