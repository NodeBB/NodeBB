'use strict';

const nconf = require('nconf');
const winston = require('winston');

const plugins = require('../plugins');
const Meta = require('./index');
const utils = require('../utils');

const Tags = module.exports;

const url = nconf.get('url');
const relative_path = nconf.get('relative_path');
const upload_url = nconf.get('upload_url');

Tags.parse = async (req, data, meta, link) => {
	const isAPI = req.res && req.res.locals && req.res.locals.isAPI;

	// Meta tags
	const defaultTags = isAPI ? [] : [{
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
		content: `frequency=30; polling-uri=${url}/sitemap.xml`,
		noEscape: true,
	}, {
		name: 'theme-color',
		content: Meta.config.themeColor || '#ffffff',
	}];

	if (Meta.config.keywords && !isAPI) {
		defaultTags.push({
			name: 'keywords',
			content: Meta.config.keywords,
		});
	}

	if (Meta.config['brand:logo'] && !isAPI) {
		defaultTags.push({
			name: 'msapplication-square150x150logo',
			content: Meta.config['brand:logo'],
			noEscape: true,
		});
	}

	const faviconPath = `${relative_path}/assets/uploads/system/favicon.ico`;
	const cacheBuster = `${Meta.config['cache-buster'] ? `?${Meta.config['cache-buster']}` : ''}`;

	// Link Tags
	const defaultLinks = isAPI ? [] : [{
		rel: 'icon',
		type: 'image/x-icon',
		href: `${faviconPath}${cacheBuster}`,
	}, {
		rel: 'manifest',
		href: `${relative_path}/manifest.webmanifest`,
		crossorigin: `use-credentials`,
	}];

	if (plugins.hooks.hasListeners('filter:search.query') && !isAPI) {
		defaultLinks.push({
			rel: 'search',
			type: 'application/opensearchdescription+xml',
			title: utils.escapeHTML(String(Meta.config.title || Meta.config.browserTitle || 'NodeBB')),
			href: `${relative_path}/osd.xml`,
		});
	}

	if (!isAPI) {
		addTouchIcons(defaultLinks);
	}

	const results = await utils.promiseParallel({
		tags: plugins.hooks.fire('filter:meta.getMetaTags', { req: req, data: data, tags: defaultTags }),
		links: plugins.hooks.fire('filter:meta.getLinkTags', { req: req, data: data, links: defaultLinks }),
	});

	meta = results.tags.tags.concat(meta || []).map((tag) => {
		if (!tag || typeof tag.content !== 'string') {
			winston.warn('Invalid meta tag. ', tag);
			return tag;
		}

		if (!tag.noEscape) {
			const attributes = Object.keys(tag);
			attributes.forEach((attr) => {
				tag[attr] = utils.escapeHTML(String(tag[attr]));
			});
		}

		return tag;
	});

	await addSiteOGImage(meta);

	addIfNotExists(meta, 'property', 'og:title', Meta.config.title || 'NodeBB');
	const ogUrl = url + (req.originalUrl !== '/' ? stripRelativePath(req.originalUrl) : '');
	addIfNotExists(meta, 'property', 'og:url', ogUrl);
	addIfNotExists(meta, 'name', 'description', Meta.config.description);
	addIfNotExists(meta, 'property', 'og:description', Meta.config.description);

	link = results.links.links.concat(link || []);
	if (isAPI) {
		const whitelist = ['canonical', 'alternate', 'up'];
		link = link.filter(link => whitelist.some(val => val === link.rel));
	}
	link = link.map((tag) => {
		if (!tag.noEscape) {
			const attributes = Object.keys(tag);
			attributes.forEach((attr) => {
				tag[attr] = utils.escapeHTML(String(tag[attr]));
			});
		}

		return tag;
	});

	return { meta, link };
};

function addTouchIcons(defaultLinks) {
	if (Meta.config['brand:touchIcon']) {
		defaultLinks.push({
			rel: 'apple-touch-icon',
			href: `${relative_path + upload_url}/system/touchicon-orig.png`,
		}, {
			rel: 'icon',
			sizes: '36x36',
			href: `${relative_path + upload_url}/system/touchicon-36.png`,
		}, {
			rel: 'icon',
			sizes: '48x48',
			href: `${relative_path + upload_url}/system/touchicon-48.png`,
		}, {
			rel: 'icon',
			sizes: '72x72',
			href: `${relative_path + upload_url}/system/touchicon-72.png`,
		}, {
			rel: 'icon',
			sizes: '96x96',
			href: `${relative_path + upload_url}/system/touchicon-96.png`,
		}, {
			rel: 'icon',
			sizes: '144x144',
			href: `${relative_path + upload_url}/system/touchicon-144.png`,
		}, {
			rel: 'icon',
			sizes: '192x192',
			href: `${relative_path + upload_url}/system/touchicon-192.png`,
		});
	} else {
		defaultLinks.push({
			rel: 'apple-touch-icon',
			href: `${relative_path}/assets/images/touch/512.png`,
		}, {
			rel: 'icon',
			sizes: '36x36',
			href: `${relative_path}/assets/images/touch/36.png`,
		}, {
			rel: 'icon',
			sizes: '48x48',
			href: `${relative_path}/assets/images/touch/48.png`,
		}, {
			rel: 'icon',
			sizes: '72x72',
			href: `${relative_path}/assets/images/touch/72.png`,
		}, {
			rel: 'icon',
			sizes: '96x96',
			href: `${relative_path}/assets/images/touch/96.png`,
		}, {
			rel: 'icon',
			sizes: '144x144',
			href: `${relative_path}/assets/images/touch/144.png`,
		}, {
			rel: 'icon',
			sizes: '192x192',
			href: `${relative_path}/assets/images/touch/192.png`,
		}, {
			rel: 'icon',
			sizes: '512x512',
			href: `${relative_path}/assets/images/touch/512.png`,
		});
	}
}

function addIfNotExists(meta, keyName, tagName, value) {
	const exists = meta.some(tag => tag[keyName] === tagName);

	if (!exists && value) {
		meta.push({
			content: utils.escapeHTML(String(value)),
			[keyName]: tagName,
		});
	}
}

function stripRelativePath(url) {
	if (url.startsWith(relative_path)) {
		return url.slice(relative_path.length);
	}

	return url;
}

async function addSiteOGImage(meta) {
	const key = Meta.config['og:image'] ? 'og:image' : 'brand:logo';
	let ogImage = stripRelativePath(Meta.config[key] || '');
	if (ogImage && !ogImage.startsWith('http')) {
		ogImage = url + ogImage;
	}

	const { images } = await plugins.hooks.fire('filter:meta.addSiteOGImage', {
		images: [{
			url: ogImage || `${url}/assets/images/logo@3x.png`,
			width: ogImage ? Meta.config[`${key}:width`] : 963,
			height: ogImage ? Meta.config[`${key}:height`] : 225,
		}],
	});

	const properties = ['url', 'secure_url', 'type', 'width', 'height', 'alt'];
	images.forEach((image) => {
		for (const property of properties) {
			if (image.hasOwnProperty(property)) {
				switch (property) {
					case 'url': {
						meta.push({
							property: 'og:image',
							content: image.url,
							noEscape: true,
						}, {
							property: 'og:image:url',
							content: image.url,
							noEscape: true,
						});
						break;
					}

					case 'secure_url': {
						meta.push({
							property: `og:${property}`,
							content: image[property],
							noEscape: true,
						});
						break;
					}

					case 'type':
					case 'alt':
					case 'width':
					case 'height': {
						meta.push({
							property: `og:image:${property}`,
							content: String(image[property]),
						});
					}
				}
			}
		}
	});
}
