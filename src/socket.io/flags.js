'use strict';

var async = require('async');

var user = require('../user');
var flags = require('../flags');

var SocketFlags = module.exports;

SocketFlags.create = function (socket, data, callback) {
	if (!socket.uid) {
		return callback(new Error('[[error:not-logged-in]]'));
	}

	if (!data || !data.type || !data.id || !data.reason) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	async.waterfall([
		async.apply(flags.validate, {
			uid: socket.uid,
			type: data.type,
			id: data.id,
		}),
		function (next) {
			// If we got here, then no errors occurred
			flags.create(data.type, data.id, socket.uid, data.reason, next);
		},
		function (flagObj, next) {
			flags.notify(flagObj, socket.uid);
			next(null, flagObj);
		},
	], callback);
};

SocketFlags.update = function (socket, data, callback) {
	if (!data || !(data.flagId && data.data)) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	var payload = {};

	async.waterfall([
		function (next) {
			async.parallel([
				async.apply(user.isAdminOrGlobalMod, socket.uid),
				async.apply(user.isModeratorOfAnyCategory, socket.uid),
			], function (err, results) {
				next(err, results[0] || results[1]);
			});
		},
		function (allowed, next) {
			if (!allowed) {
				return next(new Error('[[no-privileges]]'));
			}

			// Translate form data into object
			payload = data.data.reduce(function (memo, cur) {
				memo[cur.name] = cur.value;
				return memo;
			}, payload);

			flags.update(data.flagId, socket.uid, payload, next);
		},
		async.apply(flags.getHistory, data.flagId),
	], callback);
};

SocketFlags.appendNote = function (socket, data, callback) {
	if (!data || !(data.flagId && data.note)) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	async.waterfall([
		function (next) {
			async.parallel([
				async.apply(user.isAdminOrGlobalMod, socket.uid),
				async.apply(user.isModeratorOfAnyCategory, socket.uid),
			], function (err, results) {
				next(err, results[0] || results[1]);
			});
		},
		function (allowed, next) {
			if (!allowed) {
				return next(new Error('[[no-privileges]]'));
			}

			flags.appendNote(data.flagId, socket.uid, data.note, next);
		},
		function (next) {
			async.parallel({
				notes: async.apply(flags.getNotes, data.flagId),
				history: async.apply(flags.getHistory, data.flagId),
			}, next);
		},
	], callback);
};
