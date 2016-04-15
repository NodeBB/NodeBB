
'use strict';

var cache = require('./cache');
var plugins = require('../plugins');
var translator = require('../../public/src/modules/translator');

module.exports = function(Posts) {

	Posts.parsePost = function(postData, callback) {
		postData.content = postData.content || '';

		if (postData.pid && cache.has(postData.pid)) {
			postData.content = cache.get(postData.pid);
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

			data.postData.content = translator.escape(data.postData.content);

			if (global.env === 'production' && data.postData.pid) {
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
