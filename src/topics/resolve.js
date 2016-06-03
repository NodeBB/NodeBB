var async = require('async');


module.exports = function(Topics) {

	Topics.toggleResolve = function(tid, uid, callback){
		callback = callback || function() {};
		var isResolved;
		async.waterfall([
			function (next) {
				Topics.exists(tid, next);
			},
			function (exists, next) {
				if (!exists) {
					return next(new Error('[[error:no-topic]]'));
				}
				Topics.isResolved(tid, uid, next);
			},
			function(_isResolved, next) {
				isResolved = _isResolved;
				if (isResolved) {
					Topics.unresolve(tid, uid, next);
				}
				else {
					Topics.resolve(tid, uid, next);
				}
			},
			function(next) {
				next(null, !isResolved);
			}
		], callback);
	};

	Topics.isResolved = function(tid, uid, callback) {

		if (!parseInt(uid, 10)) {
			return callback(null, [false]);
		}

		Topics.getTopicField(tid, "resolved", callback);
	};

	Topics.unresolve = function (tid, uid, callback) {
		Topics.setTopicField(tid, "resolved", 0, callback);
	};

	Topics.resolve = function (tid, uid, callback) {
		Topics.setTopicField(tid, "resolved", 1, callback);
	};
};