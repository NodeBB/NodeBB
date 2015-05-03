
'use strict';

var cache = require('./cache'),
	plugins = require('../plugins');

module.exports = function(Posts) {

	Posts.parsePost = function(postData, callback) {
		postData.content = postData.content || '';

		var cachedContent = cache.get(postData.pid);
		if (cachedContent) {
			postData.content = cachedContent;
			return callback(null, postData);
		}

		plugins.fireHook('filter:parse.post', {postData: postData}, function(err, data) {
			if (err) {
				return callback(err);
			}
			cache.set(data.postData.pid, data.postData.content);

			callback(null, data.postData);
		});
	};

	Posts.parseSignature = function(userData, uid, callback) {
		userData.signature = userData.signature || '';

		plugins.fireHook('filter:parse.signature', {userData: userData, uid: uid}, callback);
	};
};