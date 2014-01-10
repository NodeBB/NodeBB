var	categories = require('../categories'),

	SocketCategories = {};

SocketCategories.getRecentReplies = function(tid, callback, sessionData) {
	categories.getRecentReplies(tid, sessionData.uid, 4, function(err, replies) {
		callback(replies);
	});
};

SocketCategories.get = function(callback) {
	categories.getAllCategories(0, function(err, categories) {
		if(callback) {
			callback(categories);
		}
	});
};

SocketCategories.loadMore = function(data, callback, sessionData) {
	var start = data.after,
		end = start + 9;

	categories.getCategoryTopics(data.cid, start, end, sessionData.uid, function(topics) {
		callback({
			topics: topics
		});
	});
};

module.exports = SocketCategories;