'use strict';

const nconf = require('nconf');
const winston = require('winston');

const plugins = require('../plugins');
const utils = require('../utils');
const Meta = require('./index');


const url = nconf.get('url');
const relative_path = nconf.get('relative_path');
const upload_url = nconf.get('upload_url');

const Tags = module.exports;

Tags.parse = async (req, data, meta, link) => {
	const isAPI = req.res && req.res.locals && req.res.locals.isAPI;

	// Meta tags
	const defaultTags = isAPI ? [] : [{
		name: 'viewport',
		// https://stackoverflow.com/a/77815388 for resizes-content
		content: 'width=device-width, initial-scale=1.0, interactive-widget=resizes-content',
	}, {
		name: 'content-type',
		content: 'text/html; charset=UTF-8',
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
			content: utils.cacheBustedUrl(Meta.config['brand:logo'], Meta.config['brand:logo:updatedAt']),
		});
	}

	const faviconPath = Meta.config['brand:favicon'] ?
		utils.cacheBustedUrl(Meta.config['brand:favicon'], Meta.config['brand:favicon:updatedAt']) :
		`${relative_path}/assets/uploads/system/favicon.ico`;

	// Link Tags
	const defaultLinks = isAPI ? [] : [{
		rel: 'icon',
		type: 'image/x-icon',
		href: faviconPath,
	}, {
		rel: 'manifest',
		href: `${relative_path}/manifest.webmanifest`,
		crossorigin: `use-credentials`,
	}];

	if (plugins.hooks.hasListeners('filter:search.query') && !isAPI) {
		defaultLinks.push({
			rel: 'search',
			type: 'application/opensearchdescription+xml',
			title: String(Meta.config.title || Meta.config.browserTitle || 'NodeBB'),
			href: `${relative_path}/osd.xml`,
		});
	}

	if (!isAPI) {
		addTouchIcons(defaultLinks);
	}

	const [{ tags }, { links }] = await Promise.all([
		plugins.hooks.fire('filter:meta.getMetaTags', { req, data, tags: defaultTags }),
		plugins.hooks.fire('filter:meta.getLinkTags', { req, data, links: defaultLinks }),
	]);

	meta = await Promise.all(tags.concat(meta || []).map(async (tag) => {
		if (!tag || typeof tag.content !== 'string') {
			winston.warn('Invalid meta tag. ', tag);
			return tag;
		}
		return tag;
	}));

	await addSiteOGImage(meta);

	addIfNotExists(meta, 'property', 'og:title', Meta.config.title || 'NodeBB');
	const ogUrl = url + (req.originalUrl !== '/' ? stripRelativePath(req.originalUrl) : '');
	addIfNotExists(meta, 'property', 'og:url', ogUrl);
	addIfNotExists(meta, 'name', 'description', Meta.config.description);
	addIfNotExists(meta, 'property', 'og:description', Meta.config.description);

	link = links.concat(link || []);
	if (isAPI) {
		const whitelist = ['canonical', 'alternate', 'up'];
		link = link.filter(link => whitelist.some(val => val === link.rel));
	}

	return { meta, link };
};

function addTouchIcons(defaultLinks) {
	const custom = Meta.config['brand:touchIcon'];
	const updatedAt = Meta.config['brand:touchIcon:updatedAt'];

	const config = custom ? {
		basePath: `${relative_path + upload_url}/system`,
		appleIcon: 'touchicon-orig.png',
		sizes: [36, 48, 72, 96, 144, 192],
		name: size => utils.cacheBustedUrl(`touchicon-${size}.png`, updatedAt),
	} : {
		basePath: `${relative_path}/assets/images/touch`,
		appleIcon: '512.png',
		sizes: [36, 48, 72, 96, 144, 192, 512],
		name: size => `${size}.png`,
	};

	defaultLinks.push({
		rel: 'apple-touch-icon',
		href: `${config.basePath}/${config.appleIcon}`,
	});

	config.sizes.forEach(size => defaultLinks.push({
		rel: 'icon',
		sizes: `${size}x${size}`,
		href: `${config.basePath}/${config.name(size)}`,
	}));
}

function addIfNotExists(meta, keyName, tagName, value) {
	const exists = meta.some(tag => tag[keyName] === tagName);

	if (!exists && value) {
		meta.push({
			content: String(value),
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

	ogImage = utils.cacheBustedUrl(ogImage, Meta.config[`${key}:updatedAt`]);

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
						}, {
							property: 'og:image:url',
							content: image.url,
						});
						break;
					}

					case 'secure_url': {
						meta.push({
							property: `og:${property}`,
							content: image[property],
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
