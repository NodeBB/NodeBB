'use strict';

var async = require('async');
var db = require('../../database');
var batch = require('../../batch');


module.exports = {
	name: 'Update moderation notes to hashes',
	timestamp: Date.UTC(2019, 3, 5),
	method: function (callback) {
		var progress = this.progress;

		batch.processSortedSet('users:joindate', (ids, next) => {
			async.each(ids, (uid, next) => {
				progress.incr();
				db.getSortedSetRevRange(`uid:${uid}:moderation:notes`, 0, -1, (err, notes) => {
					if (err || !notes.length) {
						return next(err);
					}

					async.eachSeries(notes, (note, next) => {
						var noteData;
						async.waterfall([
							function (next) {
								try {
									noteData = JSON.parse(note);
									noteData.timestamp = noteData.timestamp || Date.now();
									setImmediate(next);
								} catch (err) {
									next(err);
								}
							},
							function (next) {
								db.sortedSetRemove(`uid:${uid}:moderation:notes`, note, next);
							},
							function (next) {
								db.setObject(`uid:${uid}:moderation:note:${noteData.timestamp}`, {
									uid: noteData.uid,
									timestamp: noteData.timestamp,
									note: noteData.note,
								}, next);
							},
							function (next) {
								db.sortedSetAdd(`uid:${uid}:moderation:notes`, noteData.timestamp, noteData.timestamp, next);
							},
						], next);
					}, next);
				});
			}, next);
		}, {
			progress: this.progress,
		}, callback);
	},
};
