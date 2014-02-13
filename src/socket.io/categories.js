var	categories = require('../categories'),
	meta = require('./../meta'),
	user = require('./../user'),

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

	user.getSettings(socket.uid, function(err, settings) {

		var start = parseInt(data.after, 10),
			end = start + settings.topicsPerPage - 1;

		categories.getCategoryTopics(data.cid, start, end, socket.uid, callback);
	});
};

SocketCategories.getPageCount = function(socket, cid, callback) {
	categories.getPageCount(cid, socket.uid, callback);
};

module.exports = SocketCategories;