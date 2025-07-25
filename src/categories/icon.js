'use strict';

const path = require('path');
const fs = require('fs/promises');
const nconf = require('nconf');
const winston = require('winston');
const { default: satori } = require('satori');
const sharp = require('sharp');

const utils = require('../utils');

const categories = module.parent.exports;
const Icons = module.exports;

Icons._constants = Object.freeze({
	extensions: ['svg', 'png'],
});

Icons.get = async (cid) => {
	try {
		const paths = Icons._constants.extensions.map(extension => path.resolve(nconf.get('upload_path'), 'category', `category-${cid}-icon.${extension}`));
		await Promise.all(paths.map(async (path) => {
			await fs.access(path);
		}));

		return new Map(Object.entries({
			svg: `${nconf.get('upload_url')}/category/category-${cid}-icon.svg`,
			png: `${nconf.get('upload_url')}/category/category-${cid}-icon.png`,
		}));
	} catch (e) {
		return await Icons.regenerate(cid);
	}
};

Icons.flush = async (cid) => {
	winston.verbose(`[categories/icons] Flushing ${cid}.`);
	const paths = Icons._constants.extensions.map(extension => path.resolve(nconf.get('upload_path'), 'category', `category-${cid}-icon.${extension}`));

	await Promise.all(paths.map((async path => await fs.rm(path, { force: true }))));
};

Icons.regenerate = async (cid) => {
	winston.verbose(`[categories/icons] Regenerating ${cid}.`);
	const { icon, color, bgColor } = await categories.getCategoryData(cid);

	const fontPaths = new Map(Object.entries({
		regular: path.join(utils.getFontawesomePath(), 'webfonts/fa-regular-400.ttf'),
		solid: path.join(utils.getFontawesomePath(), 'webfonts/fa-solid-900.ttf'),
	}));
	const fontBuffers = new Map(Object.entries({
		regular: await fs.readFile(fontPaths.get('regular')),
		solid: await fs.readFile(fontPaths.get('solid')),
	}));

	// Retrieve unicode codepoint (hex) and weight
	let metadata = await fs.readFile(path.join(utils.getFontawesomePath(), 'metadata/icon-families.json'), 'utf-8');
	metadata = JSON.parse(metadata); // needs try..catch wrapper
	let iconString = icon.slice(3);
	iconString = iconString.split(' ').shift(); // sometimes multiple classes saved; use first
	const fontWeight = iconString.endsWith('-o') ? 400 : 900;
	iconString = iconString.endsWith('-o') ? iconString.slice(0, -2) : iconString;
	const { unicode } = metadata[iconString] || metadata.comments; // fall back to fa-comments

	// Generate and save SVG
	const svg = await satori({
		type: 'div',
		props: {
			children: String.fromCodePoint(`0x${unicode}`),
			style: {
				width: '128px',
				height: '128px',
				color,
				background: bgColor,
				fontSize: '64px',
				fontWeight,
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'center',
			},
		},
	}, {
		width: 128,
		height: 128,
		fonts: [{
			name: 'Font Awesome 6 Free',
			data: fontBuffers.get('regular'),
			weight: 400,
			style: 'normal',
		}, {
			name: 'Font Awesome 6 Free',
			data: fontBuffers.get('solid'),
			weight: 900,
			style: 'normal',
		}],
	});
	await fs.writeFile(path.resolve(nconf.get('upload_path'), 'category', `category-${cid}-icon.svg`), svg);

	// Generate and save PNG
	const pngBuffer = await sharp(Buffer.from(svg))
		.png()
		.toBuffer();

	await fs.writeFile(path.resolve(nconf.get('upload_path'), 'category', `category-${cid}-icon.png`), pngBuffer);

	return new Map(Object.entries({
		svg: `${nconf.get('upload_url')}/category/category-${cid}-icon.svg`,
		png: `${nconf.get('upload_url')}/category/category-${cid}-icon.png`,
	}));
};
