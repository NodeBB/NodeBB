'use strict';

const path = require('path');
const fs = require('fs');
const util = require('util');
const readFileAsync = util.promisify(fs.readFile);
const truncateAsync = util.promisify(fs.truncate);
const Logs = module.exports;

Logs.path = path.join(__dirname, '..', '..', 'logs', 'output.log');

Logs.get = async function () {
	return await readFileAsync(Logs.path, 'utf-8');
};

Logs.clear = async function () {
	return await truncateAsync(Logs.path, 0);
};
