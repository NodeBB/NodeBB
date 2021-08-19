'use strict';


const async = require('async');
const crypto = require('crypto');
const nconf = require('nconf');
const batch = require('../../batch');
const db = require('../../database');

module.exports = {
	name: 'Hash all IP addresses stored in Recent IPs zset',
	timestamp: Date.UTC(2018, 5, 22),
	method: function (callback) {
		const { progress } = this;
		const hashed = /[a-f0-9]{32}/;
		let hash;

		batch.processSortedSet('ip:recent', (ips, next) => {
			async.each(ips, (set, next) => {
				// Short circuit if already processed
				if (hashed.test(set.value)) {
					progress.incr();
					return setImmediate(next);
				}

				hash = crypto.createHash('sha1').update(set.value + nconf.get('secret')).digest('hex');

				async.series([
					async.apply(db.sortedSetAdd, 'ip:recent', set.score, hash),
					async.apply(db.sortedSetRemove, 'ip:recent', set.value),
				], (err) => {
					progress.incr();
					next(err);
				});
			}, next);
		}, {
			withScores: 1,
			progress: this.progress,
		}, callback);
	},
};
