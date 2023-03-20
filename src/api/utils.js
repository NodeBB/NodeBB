'use strict';

const db = require('../database');

const utils = module.exports;

// internal token management utilities only

utils.log = async (token) => {
	await db.sortedSetAdd('tokens:lastSeen', Date.now(), token);
};
