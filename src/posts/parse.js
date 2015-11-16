
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

		// Casting post content into a string, just in case
		if (typeof postData.content !== 'string') {
			postData.content = postData.content.toString();
		}

		plugins.fireHook('filter:parse.post', {postData: postData}, function(err, data) {
			if (err) {
				return callback(err);
			}

			if (global.env === 'production') {
				cache.set(data.postData.pid, data.postData.content);
			}

			callback(null, data.postData);
		});
	};

	Posts.parseSignature = function(userData, uid, callback) {
		userData.signature = userData.signature || '';

		plugins.fireHook('filter:parse.signature', {userData: userData, uid: uid}, callback);
	};
};