'use strict';

var nconf = require('nconf');
var url = require('url');
var winston = require('winston');

var meta = require('../meta');
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

	Posts.parsePost = async function (postData) {
		if (!postData) {
			return postData;
		}
		postData.content = String(postData.content || '');
		const cache = require('./cache');
		const pid = String(postData.pid);
		const cachedContent = cache.get(pid);
		if (postData.pid && cachedContent !== undefined) {
			postData.content = cachedContent;
			cache.hits += 1;
			return postData;
		}
		cache.misses += 1;
		const data = await plugins.fireHook('filter:parse.post', { postData: postData });
		data.postData.content = translator.escape(data.postData.content);
		if (global.env === 'production' && data.postData.pid) {
			cache.set(pid, data.postData.content);
		}
		return data.postData;
	};

	Posts.parseSignature = async function (userData, uid) {
		userData.signature = sanitizeSignature(userData.signature || '');
		return await plugins.fireHook('filter:parse.signature', { userData: userData, uid: uid });
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

		if (meta.config['signatures:disableLinks']) {
			tagsToStrip.push('a');
		}

		if (meta.config['signatures:disableImages']) {
			tagsToStrip.push('img');
		}

		return utils.stripHTMLTags(signature, tagsToStrip);
	}
};
