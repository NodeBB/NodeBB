'use strict';

const path = require('path');
const fs = require('fs');
const util = require('util');

let mkdirp = require('mkdirp');
mkdirp = mkdirp.hasOwnProperty('native') ? mkdirp : util.promisify(mkdirp);

const rimraf = require('rimraf');
const rimrafAsync = util.promisify(rimraf);

const file = require('../file');
const plugins = require('../plugins');
const user = require('../user');
const Meta = require('./index');

const soundsPath = path.join(__dirname, '../../build/public/sounds');
const uploadsPath = path.join(__dirname, '../../public/uploads/sounds');

const Sounds = module.exports;

Sounds.addUploads = async function addUploads() {
	let files = [];
	try {
		files = await fs.promises.readdir(uploadsPath);
	} catch (err) {
		if (err.code !== 'ENOENT') {
			throw err;
		}
		files = [];
	}

	var uploadSounds = files.reduce(function (prev, fileName) {
		var name = fileName.split('.');
		if (!name.length || !name[0].length) {
			return prev;
		}
		name = name[0];
		name = name[0].toUpperCase() + name.slice(1);

		prev[name] = fileName;
		return prev;
	}, {});

	plugins.soundpacks = plugins.soundpacks.filter(pack => pack.name !== 'Uploads');

	if (Object.keys(uploadSounds).length) {
		plugins.soundpacks.push({
			name: 'Uploads',
			id: 'uploads',
			dir: uploadsPath,
			sounds: uploadSounds,
		});
	}
};

Sounds.build = async function build() {
	await Sounds.addUploads();

	var map = plugins.soundpacks.map(function (pack) {
		return Object.keys(pack.sounds).reduce(function (prev, soundName) {
			var soundPath = pack.sounds[soundName];
			prev[pack.name + ' | ' + soundName] = pack.id + '/' + soundPath;
			return prev;
		}, {});
	});
	map.unshift({});
	map = Object.assign.apply(null, map);
	await rimrafAsync(soundsPath);
	await mkdirp(soundsPath);

	await fs.promises.writeFile(path.join(soundsPath, 'fileMap.json'), JSON.stringify(map));

	await Promise.all(plugins.soundpacks.map(pack => file.linkDirs(pack.dir, path.join(soundsPath, pack.id), false)));
};

var keys = ['chat-incoming', 'chat-outgoing', 'notification'];

Sounds.getUserSoundMap = async function getUserSoundMap(uid) {
	const [defaultMapping, userSettings] = await Promise.all([
		Meta.configs.getFields(keys),
		user.getSettings(uid),
	]);

	userSettings.notification = userSettings.notificationSound;
	userSettings['chat-incoming'] = userSettings.incomingChatSound;
	userSettings['chat-outgoing'] = userSettings.outgoingChatSound;

	const soundMapping = {};

	keys.forEach(function (key) {
		if (userSettings[key] || userSettings[key] === '') {
			soundMapping[key] = userSettings[key] || '';
		} else {
			soundMapping[key] = defaultMapping[key] || '';
		}
	});

	return soundMapping;
};
