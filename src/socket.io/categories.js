var	categories = require('../categories'),

	SocketCategories = {};

SocketCategories.getRecentReplies = function(socket, tid, callback) {
	categories.getRecentReplies(tid, socket.uid, 4, callback);
};

SocketCategories.get = function(socket, data, callback) {
	categories.getAllCategories(0, callback);
};

SocketCategories.loadMore = function(socket, data, callback) {
	if(!data) {
		return callback(new Error('invalid data'));
	}

	var start = data.after,
		end = start + 9;

	categories.getCategoryTopics(data.cid, start, end, socket.uid, function(err, topics) {
		callback(err, {
			topics: topics
		});
	});
};

module.exports = SocketCategories;