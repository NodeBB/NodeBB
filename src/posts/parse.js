'use strict';

const nconf = require('nconf');
const fs = require('fs').promises;
const path = require('path');
const url = require('url');
const dns = require('dns');
const winston = require('winston');
const sanitize = require('sanitize-html');
const _ = require('lodash');
const { getLinkPreview } = require('link-preview-js');

const meta = require('../meta');
const plugins = require('../plugins');
const translator = require('../translator');
const utils = require('../utils');

let sanitizeConfig = {
	allowedTags: sanitize.defaults.allowedTags.concat([
		// Some safe-to-use tags to add
		'sup', 'ins', 'del', 'img', 'button',
		'video', 'audio', 'iframe', 'embed',
		// 'sup' still necessary until https://github.com/apostrophecms/sanitize-html/pull/422 merged
	]),
	allowedAttributes: {
		...sanitize.defaults.allowedAttributes,
		a: ['href', 'name', 'hreflang', 'media', 'rel', 'target', 'type'],
		img: ['alt', 'height', 'ismap', 'src', 'usemap', 'width', 'srcset'],
		iframe: ['height', 'name', 'src', 'width'],
		video: ['autoplay', 'controls', 'height', 'loop', 'muted', 'poster', 'preload', 'src', 'width'],
		audio: ['autoplay', 'controls', 'loop', 'muted', 'preload', 'src'],
		embed: ['height', 'src', 'type', 'width'],
	},
	globalAttributes: ['accesskey', 'class', 'contenteditable', 'dir',
		'draggable', 'dropzone', 'hidden', 'id', 'lang', 'spellcheck', 'style',
		'tabindex', 'title', 'translate', 'aria-expanded', 'data-*',
	],
	allowedClasses: {
		...sanitize.defaults.allowedClasses,
	},
};

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
			return postData;
		}

		const data = await plugins.hooks.fire('filter:parse.post', { postData: postData });
		data.postData.content = translator.escape(data.postData.content);
		if (data.postData.pid) {
			cache.set(pid, data.postData.content);
		}
		return data.postData;
	};

	Posts.parseSignature = async function (userData, uid) {
		userData.signature = sanitizeSignature(userData.signature || '');
		return await plugins.hooks.fire('filter:parse.signature', { userData: userData, uid: uid });
	};

	Posts.relativeToAbsolute = function (content, regex) {
		// Turns relative links in content to absolute urls
		if (!content) {
			return content;
		}
		let parsed;
		let current = regex.regex.exec(content);
		let absolute;
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
							absolute = `//${current[1]}`;
						}

						content = content.slice(0, current.index + regex.length) +
						absolute +
						content.slice(current.index + regex.length + current[1].length);
					}
				} catch (err) {
					winston.verbose(err.messsage);
				}
			}
			current = regex.regex.exec(content);
		}

		return content;
	};

	Posts.sanitize = function (content) {
		return sanitize(content, {
			allowedTags: sanitizeConfig.allowedTags,
			allowedAttributes: sanitizeConfig.allowedAttributes,
			allowedClasses: sanitizeConfig.allowedClasses,
		});
	};

	Posts.configureSanitize = async () => {
		// Each allowed tags should have some common global attributes...
		sanitizeConfig.allowedTags.forEach((tag) => {
			sanitizeConfig.allowedAttributes[tag] = _.union(
				sanitizeConfig.allowedAttributes[tag],
				sanitizeConfig.globalAttributes
			);
		});

		// Some plugins might need to adjust or whitelist their own tags...
		sanitizeConfig = await plugins.hooks.fire('filter:sanitize.config', sanitizeConfig);
	};

	Posts.processEmbeds = async (content) => {
		const { app } = require('../webserver');
		const anchorRegex = /<a\s+(?:[^>]*?\s+)?href=["']([^"']*)["'][^>]*>(.*?)<\/a>/g;
		const matches = [];
		let match;

		// eslint-disable-next-line no-cond-assign
		while ((match = anchorRegex.exec(content)) !== null) {
			matches.push(match);
		}

		const previews = await Promise.all(matches.map(async (match) => {
			const anchor = match[1];
			try {
				const preview = await getLinkPreview(anchor, {
					resolveDNSHost: async url => new Promise((resolve, reject) => {
						const { hostname } = new URL(url);
						dns.lookup(hostname, (err, address) => {
							if (err) {
								reject(err);
								return;
							}

							resolve(address); // if address resolves to localhost or '127.0.0.1' library will throw an error
						});
					}),
				});

				if (preview.contentType === 'text/html') {
					console.log(preview);
					return await app.renderAsync('partials/posts/embed', preview);
				}

				return false;
			} catch (e) {
				return false;
			}
		}));
		console.log(previews);

		// Replace match with embed
		previews.forEach((preview, idx) => {
			if (preview) {
				const match = matches[idx];
				const { index } = match;
				const { length } = match[0];

				content = `${content.substring(0, index)}${preview}${content.substring(index + length)}`;
			}
		});

		return content;
	};

	Posts.registerHooks = () => {
		plugins.hooks.register('core', {
			hook: 'filter:parse.post',
			method: [
				async (data) => {
					data.postData.content = Posts.sanitize(data.postData.content);
					return data;
				},
				async (data) => {
					console.log(data);
					data.postData.content = await Posts.processEmbeds(data.postData.content);
					return data;
				},
			],
		});

		plugins.hooks.register('core', {
			hook: 'filter:parse.raw',
			method: async content => Posts.sanitize(content),
		});

		plugins.hooks.register('core', {
			hook: 'filter:parse.aboutme',
			method: async content => Posts.sanitize(content),
		});

		plugins.hooks.register('core', {
			hook: 'filter:parse.signature',
			method: async (data) => {
				data.userData.signature = Posts.sanitize(data.userData.signature);
				return data;
			},
		});
	};

	function sanitizeSignature(signature) {
		signature = translator.escape(signature);
		const tagsToStrip = [];

		if (meta.config['signatures:disableLinks']) {
			tagsToStrip.push('a');
		}

		if (meta.config['signatures:disableImages']) {
			tagsToStrip.push('img');
		}

		return utils.stripHTMLTags(signature, tagsToStrip);
	}
};
