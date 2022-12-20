'use strict';


import async from 'async';
import winston from 'winston';
import db from '../../database';
import * as batch from '../../batch';

export const obj = {
	name: 'Removing best posts with negative scores',
	timestamp: Date.UTC(2016, 7, 5),
	method: function (callback) {
		batch.processSortedSet('users:joindate', (ids, next) => {
			async.each(ids, (id, next) => {
				winston.verbose(`processing uid ${id}`);
				db.sortedSetsRemoveRangeByScore([`uid:${id}:posts:votes`], '-inf', 0, next);
			}, next);
		}, {}, callback);
	},
};
