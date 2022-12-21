'use strict';


const async = require('async');
const winston = require('winston');
const db = require('../../database');

module.exports = {
	name: 'Removing best posts with negative scores',
	timestamp: Date.UTC(2016, 7, 5),
	method: function (callback) {
		const batch = require('../../batch');
		batch.processSortedSet('users:joindate', (ids, next) => {
			async.each(ids, (id, next) => {
				winston.verbose(`processing uid ${id}`);
				db.sortedSetsRemoveRangeByScore([`uid:${id}:posts:votes`], '-inf', 0, next);
			}, next);
		}, {}, callback);
	},
};
