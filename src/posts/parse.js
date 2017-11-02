'use strict';

var async = require('async');
var nconf = require('nconf');
var url = require('url');
var winston = require('winston');

var meta = require('../meta');
var cache = require('./cache');
var plugins = require('../plugins');
var translator = require('../translator');
var utils = require('../utils');

module.exports = function (Posts) {
	Posts.urlRegex = {
		regex: /href="([^"]+)"/g,
		length: 6,
	};

	Posts.imgRegex = {
		regex: /src="([^"]+)"/g,
		length: 5,
	};

	Posts.parsePost = function (postData, callback) {
		postData.content = String(postData.content || '');

		if (postData.pid && cache.has(String(postData.pid))) {
			postData.content = cache.get(String(postData.pid));
			return callback(null, postData);
		}

		async.waterfall([
			function (next) {
				plugins.fireHook('filter:parse.post', { postData: postData }, next);
			},
			function (data, next) {
				data.postData.content = translator.escape(data.postData.content);

				if (global.env === 'production' && data.postData.pid) {
					cache.set(String(data.postData.pid), data.postData.content);
				}
				next(null, data.postData);
			},
		], callback);
	};

	Posts.parseSignature = function (userData, uid, callback) {
		userData.signature = sanitizeSignature(userData.signature || '');
		plugins.fireHook('filter:parse.signature', { userData: userData, uid: uid }, callback);
	};

	Posts.relativeToAbsolute = function (content, regex) {
		// Turns relative links in post body to absolute urls
		var parsed;
		var current = regex.regex.exec(content);
		var absolute;
		while (current !== null) {
			if (current[1]) {
				try {
					parsed = url.parse(current[1]);
					if (!parsed.protocol) {
						if (current[1].startsWith('/')) {
							// Internal link
							absolute = nconf.get('base_url') + current[1];
						} else {
							// External link
							absolute = '//' + current[1];
						}

						content = content.slice(0, current.index + regex.length) + absolute + content.slice(current.index + regex.length + current[1].length);
					}
				} catch (err) {
					winston.verbose(err.messsage);
				}
			}
			current = regex.regex.exec(content);
		}

		return content;
	};

	function sanitizeSignature(signature) {
		signature = translator.escape(signature);
		var tagsToStrip = [];

		if (parseInt(meta.config['signatures:disableLinks'], 10) === 1) {
			tagsToStrip.push('a');
		}

		if (parseInt(meta.config['signatures:disableImages'], 10) === 1) {
			tagsToStrip.push('img');
		}

		return utils.stripHTMLTags(signature, tagsToStrip);
	}
};
