'use strict';

const db = require('../database');

const utils = module.exports;

// internal token management utilities only

utils.log = async (token) => {
	await db.sortedSetAdd('tokens:lastSeen', Date.now(), token);
};

utils.getLastSeen = async tokens => await db.sortedSetScores('tokens:lastSeen', tokens);
