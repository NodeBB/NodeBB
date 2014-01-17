var	categories = require('../categories'),

	SocketCategories = {};

SocketCategories.getRecentReplies = function(socket, tid, callback) {
	categories.getRecentReplies(tid, socket.uid, 4, callback);
};

SocketCategories.get = function(socket, data, callback) {
	categories.getAllCategories(0, callback);
};

SocketCategories.loadMore = function(socket, data, callback) {
	var start = data.after,
		end = start + 9;

	categories.getCategoryTopics(data.cid, start, end, socket.uid, function(topics) {
		callback(null, {
			topics: topics
		});
	});
};

module.exports = SocketCategories;