'use strict';

var db = require('../../database');
var batch = require('../../batch');

var async = require('async');
var crypto = require('crypto');
var nconf = require('nconf');

module.exports = {
	name: 'Hash all IP addresses stored in Recent IPs zset',
	timestamp: Date.UTC(2018, 5, 22),
	method: function (callback) {
		const progress = this.progress;
		var hashed = /[a-f0-9]{32}/;
		let hash;

		batch.processSortedSet('ip:recent', function (ips, next) {
			async.each(ips, function (set, next) {
				// Short circuit if already processed
				if (hashed.test(set.value)) {
					progress.incr();
					return setImmediate(next);
				}

				hash = crypto.createHash('sha1').update(set.value + nconf.get('secret')).digest('hex');

				async.series([
					async.apply(db.sortedSetAdd, 'ip:recent', set.score, hash),
					async.apply(db.sortedSetRemove, 'ip:recent', set.value),
				], function (err) {
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
