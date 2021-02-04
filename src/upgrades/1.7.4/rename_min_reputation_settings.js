'use strict';

const db = require('../../database');

module.exports = {
	name: 'Rename privileges:downvote and privileges:flag to min:rep:downvote, min:rep:flag respectively',
	timestamp: Date.UTC(2018, 0, 12),
	method: function (callback) {
		db.getObjectFields('config', ['privileges:downvote', 'privileges:flag'], (err, config) => {
			if (err) {
				return callback(err);
			}

			db.setObject('config', {
				'min:rep:downvote': parseInt(config['privileges:downvote'], 10) || 0,
				'min:rep:flag': parseInt(config['privileges:downvote'], 10) || 0,
			}, (err) => {
				if (err) {
					return callback(err);
				}
				db.deleteObjectFields('config', ['privileges:downvote', 'privileges:flag'], callback);
			});
		});
	},
};
