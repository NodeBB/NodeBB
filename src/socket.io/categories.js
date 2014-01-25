var	categories = require('../categories'),
	meta = require('./../meta'),

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

	var topicsPerPage = parseInt(meta.config.topicsPerPage, 10) || 20;

	var start = data.after,
		end = start + topicsPerPage - 1;

	categories.getCategoryTopics(data.cid, start, end, socket.uid, function(err, topics) {
		callback(err, {
			topics: topics
		});
	});
};

SocketCategories.loadPage = function(socket, data, callback) {
	if(!data) {
		return callback(new Error('invalid data'));
	}

	var topicsPerPage = parseInt(meta.config.topicsPerPage, 10) || 20;

	var start = (data.page - 1) * topicsPerPage,
		end = start + topicsPerPage - 1;

	categories.getCategoryTopics(data.cid, start, end, socket.uid, function(err, topics) {
		callback(err, {
			topics: topics
		});
	});
}

SocketCategories.getPageCount = function(socket, cid, callback) {
	categories.getPageCount(cid, callback);
}

module.exports = SocketCategories;