var db = require('./database'),
	async = require('async'),
	user = require('./user');


(function(Messaging) {

	function sortUids(fromuid, touid) {
		var uids = [fromuid, touid];
		uids.sort();
		return uids;
	}

	Messaging.addMessage = function(fromuid, touid, content, callback) {
		var uids = sortUids(fromuid, touid);

		db.incrObjectField('global', 'nextMid', function(err, mid) {
			if (err) {
				return callback(err, null);
			}

			var message = {
				content: content,
				timestamp: Date.now(),
				fromuid: fromuid,
				touid: touid
			};

			db.setObject('message:' + mid, message);
			db.listAppend('messages:' + uids[0] + ':' + uids[1], mid);

			callback(null, message);
		});
	}

	Messaging.getMessages = function(fromuid, touid, callback) {
		var uids = sortUids(fromuid, touid);

		db.getListRange('messages:' + uids[0] + ':' + uids[1], 0, -1, function(err, mids) {
			if (err) {
				return callback(err, null);
			}

			if (!mids || !mids.length) {
				return callback(null, []);
			}


			user.getUserField(touid, 'username', function(err, tousername) {

				var messages = [];

				function getMessage(mid, next) {
					db.getObject('message:' + mid, function(err, message) {
						if (err) {
							return next(err);
						}

						if (message.fromuid === fromuid) {
							message.content = 'You : ' + message.content;
						} else {
							message.content = tousername + ' : ' + message.content;
						}

						messages.push(message);
						next(null);
					});
				}

				async.eachSeries(mids, getMessage, function(err) {
					if (err) {
						return callback(err, null);
					}

					callback(null, messages);
				});
			});
		});
	}

}(exports));