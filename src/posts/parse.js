'use strict';

const crypto = require('crypto');
const nconf = require('nconf');
const winston = require('winston');
const sanitize = require('sanitize-html');
const _ = require('lodash');

const db = require('../database');
const meta = require('../meta');
const plugins = require('../plugins');
const utils = require('../utils');
const postCache = require('./cache');
const devMode = process.env.NODE_ENV === 'development';

let sanitizeConfig = {
	allowedTags: sanitize.defaults.allowedTags.concat([
		// Some safe-to-use tags to add
		'ins', 'del', 'img', 'button',
		'video', 'audio', 'source', 'iframe', 'embed',
	]),
	allowedAttributes: {
		...sanitize.defaults.allowedAttributes,
		a: ['href', 'name', 'hreflang', 'media', 'rel', 'target', 'type', 'component'],
		img: ['alt', 'height', 'ismap', 'src', 'usemap', 'width', 'srcset', 'component'],
		iframe: ['height', 'name', 'src', 'width', 'allow', 'frameborder'],
		video: ['autoplay', 'playsinline', 'controls', 'height', 'loop', 'muted', 'poster', 'preload', 'src', 'width'],
		audio: ['autoplay', 'controls', 'loop', 'muted', 'preload', 'src'],
		source: ['type', 'src', 'srcset', 'sizes', 'media', 'height', 'width'],
		embed: ['height', 'src', 'type', 'width'],
		span: ['component'],
	},
	nonBooleanAttributes: ['accesskey', 'class', 'contenteditable', 'dir',
		'draggable', 'dropzone', 'hidden', 'id', 'lang', 'spellcheck', 'style',
		'tabindex', 'title', 'translate', 'aria-*', 'data-*',
	],
};
const allowedTypes = new Set(['default', 'plaintext', 'activitypub.note', 'activitypub.article', 'markdown']);

module.exports = function (Posts) {
	Posts.urlRegex = /href="([^"]+)"/g;
	Posts.imgRegex = /src="([^"]+)"/g;
	Posts.mdImageUrlRegex = /\[.+?\]\(([^\\)]+)\)/g;

	Posts.parsePost = async function (postData, type) {
		if (!postData) {
			return postData;
		}

		if (!type || !allowedTypes.has(type)) {
			type = 'default';
		}
		postData.content = String(postData.sourceContent || postData.content || '');
		const cache = postCache.getOrCreate();
		const cacheKey = `${String(postData.pid)}|${type}`;
		const cachedContent = cache.get(cacheKey);

		if (postData.pid && cachedContent !== undefined) {
			postData.content = cachedContent;
			return postData;
		}

		if (!type.startsWith('activitypub.')) {
			postData.content = postData.content.replace(meta.config.activitypubBreakString, '');
		}
		({ postData } = await plugins.hooks.fire('filter:parse.post', { postData, type }));
		postData.content = await Posts.addImageDimensions(postData);
		if (postData.pid) {
			cache.set(cacheKey, postData.content);
		}

		return postData;
	};

	const imgTagRegex = /<img\s[^>]*?src="([^"]+)"[^>]*?>/g;
	const hasDimensionRegex = /\s(?:width|height)\s*=/i;
	const uploadPathRegex = /\/assets\/uploads(\/files\/[^\s")]+\.?[\w]*)/;
	const md5 = filename => crypto.createHash('md5').update(filename).digest('hex');

	// Adds intrinsic width/height to local uploaded images so they reserve
	// space before loading, preventing layout shift in rendered posts.
	// Sizes are stored in `upload:<md5>` hashes by Posts.uploads.saveSize
	Posts.addImageDimensions = async function (postData) {
		const { content } = postData;
		if (!content || !content.includes('<img')) {
			return content;
		}
		// Callers share parsed content through the post cache, so a caller that
		// did not select `uploads` would cache unsized content for the others.
		// The routes that render posts select it; this covers the remaining ones
		let { uploads } = postData;
		if (!uploads && postData.pid) {
			uploads = await Posts.uploads.list(postData.pid);
		}
		if (!Array.isArray(uploads) || !uploads.length) {
			return content;
		}

		const sizes = await db.getObjects(uploads.map(filePath => `upload:${md5(filePath)}`));
		const sizeByPath = new Map();
		uploads.forEach((filePath, idx) => {
			const size = sizes[idx];
			if (size && size.width && size.height) {
				sizeByPath.set(filePath, size);
			}
		});
		if (!sizeByPath.size) {
			return content;
		}

		return content.replace(imgTagRegex, (tag, src) => {
			if (hasDimensionRegex.test(tag)) {
				return tag;
			}
			const match = src.match(uploadPathRegex);
			const size = match && sizeByPath.get(match[1].replace('-resized', ''));
			if (!size) {
				return tag;
			}
			return `<img width="${size.width}" height="${size.height}" ${tag.slice('<img '.length)}`;
		});
	};

	Posts.clearCachedPost = function (pid) {
		const cache = require('./cache');
		cache.del(Array.from(allowedTypes).map(type => `${String(pid)}|${type}`));
	};

	Posts.parseSignature = async function (userData, uid) {
		userData.signature = sanitizeSignature(userData.signature || '');
		const result = await plugins.hooks.fire('filter:parse.signature', { userData: userData, uid: uid });
		return result;
	};

	Posts.relativeToAbsolute = function (content, regex) {
		// Turns relative links in content to absolute urls
		if (!content) {
			return content;
		}
		let parsed;
		let current = regex.exec(content);
		let absolute;
		while (current !== null) {
			if (current[1]) {
				try {
					parsed = new URL(current[1], nconf.get('url'));
					absolute = parsed.toString();
					if (absolute !== current[1]) {
						const offset = current[0].indexOf(current[1]);
						content = content.slice(0, current.index + offset) +
						absolute +
						content.slice(current.index + offset + current[1].length);
					}
				} catch (err) {
					if (devMode) {
						winston.verbose(err.messsage);
					}
				}
			}
			current = regex.exec(content);
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

	Posts.sanitizePlaintext = content => sanitize(content, {
		allowedTags: [],
	});

	Posts.configureSanitize = async () => {
		// Each allowed tags should have some common global attributes...
		sanitizeConfig.allowedTags.forEach((tag) => {
			sanitizeConfig.allowedAttributes[tag] = _.union(
				sanitizeConfig.allowedAttributes[tag],
				sanitizeConfig.nonBooleanAttributes
			);
		});

		// Some plugins might need to adjust or whitelist their own tags...
		sanitizeConfig = await plugins.hooks.fire('filter:sanitize.config', sanitizeConfig);
	};

	Posts.registerHooks = () => {
		plugins.hooks.register('core', {
			hook: 'filter:parse.post',
			method: async (data) => {
				data.postData.content = Posts[data.type !== 'plaintext' ? 'sanitize' : 'sanitizePlaintext'](data.postData.content);
				return data;
			},
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
