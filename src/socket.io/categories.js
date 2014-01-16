var	categories = require('../categories'),

	SocketCategories = {};

SocketCategories.getRecentReplies = function(socket, tid, callback) {
	categories.getRecentReplies(tid, socket.uid, 4, function(err, replies) {
		callback(replies);
	});
};

SocketCategories.get = function(socket, data, callback) {
	categories.getAllCategories(0, function(err, categories) {
		if(callback) {
			callback(categories);
		}
	});
};

SocketCategories.loadMore = function(socket, data, callback) {
	var start = data.after,
		end = start + 9;

	categories.getCategoryTopics(data.cid, start, end, socket.uid, function(topics) {
		callback({
			topics: topics
		});
	});
};

module.exports = SocketCategories;