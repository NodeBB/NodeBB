'use strict';

var nconf = require('nconf');
var async = require('async');
var winston = require('winston');

var plugins = require('../plugins');
var Meta = require('../meta');
var utils = require('../utils');

var Tags = module.exports;

Tags.parse = function (req, data, meta, link, callback) {
	async.parallel({
		tags: function (next) {
			var defaultTags = [{
				name: 'viewport',
				content: 'width=device-width, initial-scale=1.0',
			}, {
				name: 'content-type',
				content: 'text/html; charset=UTF-8',
				noEscape: true,
			}, {
				name: 'apple-mobile-web-app-capable',
				content: 'yes',
			}, {
				name: 'mobile-web-app-capable',
				content: 'yes',
			}, {
				property: 'og:site_name',
				content: Meta.config.title || 'NodeBB',
			}, {
				name: 'msapplication-badge',
				content: 'frequency=30; polling-uri=' + nconf.get('url') + '/sitemap.xml',
				noEscape: true,
			}];

			if (Meta.config.keywords) {
				defaultTags.push({
					name: 'keywords',
					content: Meta.config.keywords,
				});
			}

			if (Meta.config['brand:logo']) {
				defaultTags.push({
					name: 'msapplication-square150x150logo',
					content: Meta.config['brand:logo'],
					noEscape: true,
				});
			}

			plugins.fireHook('filter:meta.getMetaTags', { req: req, data: data, tags: defaultTags }, next);
		},
		links: function (next) {
			var defaultLinks = [{
				rel: 'icon',
				type: 'image/x-icon',
				href: nconf.get('relative_path') + nconf.get('upload_url') + '/system/favicon.ico' + (Meta.config['cache-buster'] ? '?' + Meta.config['cache-buster'] : ''),
			}, {
				rel: 'manifest',
				href: nconf.get('relative_path') + '/manifest.json',
			}];

			if (plugins.hasListeners('filter:search.query')) {
				defaultLinks.push({
					rel: 'search',
					type: 'application/opensearchdescription+xml',
					title: utils.escapeHTML(String(Meta.config.title || Meta.config.browserTitle || 'NodeBB')),
					href: nconf.get('relative_path') + '/osd.xml',
				});
			}

			// Touch icons for mobile-devices
			if (Meta.config['brand:touchIcon']) {
				defaultLinks.push({
					rel: 'apple-touch-icon',
					href: nconf.get('relative_path') + nconf.get('upload_url') + '/system/touchicon-orig.png',
				}, {
					rel: 'icon',
					sizes: '36x36',
					href: nconf.get('relative_path') + nconf.get('upload_url') + '/system/touchicon-36.png',
				}, {
					rel: 'icon',
					sizes: '48x48',
					href: nconf.get('relative_path') + nconf.get('upload_url') + '/system/touchicon-48.png',
				}, {
					rel: 'icon',
					sizes: '72x72',
					href: nconf.get('relative_path') + nconf.get('upload_url') + '/system/touchicon-72.png',
				}, {
					rel: 'icon',
					sizes: '96x96',
					href: nconf.get('relative_path') + nconf.get('upload_url') + '/system/touchicon-96.png',
				}, {
					rel: 'icon',
					sizes: '144x144',
					href: nconf.get('relative_path') + nconf.get('upload_url') + '/system/touchicon-144.png',
				}, {
					rel: 'icon',
					sizes: '192x192',
					href: nconf.get('relative_path') + nconf.get('upload_url') + '/system/touchicon-192.png',
				});
			}
			plugins.fireHook('filter:meta.getLinkTags', { req: req, data: data, links: defaultLinks }, next);
		},
	}, function (err, results) {
		if (err) {
			return callback(err);
		}

		meta = results.tags.tags.concat(meta || []).map(function (tag) {
			if (!tag || typeof tag.content !== 'string') {
				winston.warn('Invalid meta tag. ', tag);
				return tag;
			}

			if (!tag.noEscape) {
				tag.content = utils.escapeHTML(String(tag.content));
			}

			return tag;
		});

		addIfNotExists(meta, 'property', 'og:title', Meta.config.title || 'NodeBB');

		var ogUrl = nconf.get('url') + (req.originalUrl !== '/' ? stripRelativePath(req.originalUrl) : '');
		addIfNotExists(meta, 'property', 'og:url', ogUrl);

		addIfNotExists(meta, 'name', 'description', Meta.config.description);
		addIfNotExists(meta, 'property', 'og:description', Meta.config.description);

		var ogImage = stripRelativePath(Meta.config['og:image'] || Meta.config['brand:logo'] || '');
		if (ogImage && !ogImage.startsWith('http')) {
			ogImage = nconf.get('url') + ogImage;
		}
		addIfNotExists(meta, 'property', 'og:image', ogImage);
		if (ogImage) {
			addIfNotExists(meta, 'property', 'og:image:width', Meta.config['og:image:width'] || 200);
			addIfNotExists(meta, 'property', 'og:image:height', Meta.config['og:image:height'] || 200);
		}

		link = results.links.links.concat(link || []);

		callback(null, {
			meta: meta,
			link: link,
		});
	});
};

function addIfNotExists(meta, keyName, tagName, value) {
	var exists = false;
	meta.forEach(function (tag) {
		if (tag[keyName] === tagName) {
			exists = true;
		}
	});

	if (!exists && value) {
		var data = {
			content: utils.escapeHTML(String(value)),
		};
		data[keyName] = tagName;
		meta.push(data);
	}
}

function stripRelativePath(url) {
	if (url.startsWith(nconf.get('relative_path'))) {
		return url.slice(nconf.get('relative_path').length);
	}

	return url;
}
