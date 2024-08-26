'use strict';

const nconf = require('nconf');

nconf.argv().env({
	separator: '__',
});

const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const winston = require('winston');

process.env.NODE_ENV = process.env.NODE_ENV || 'production';

// Alternate configuration file support
const configFile = path.resolve(__dirname, '../../../', nconf.any(['config', 'CONFIG']) || 'config.json');
const prestart = require('../../prestart');

prestart.loadConfig(configFile);
prestart.setupWinston();

const db = require('../../database');

process.on('message', async (msg) => {
	if (msg && msg.uid) {
		await db.init();

		const targetUid = msg.uid;

		const archivePath = path.join(__dirname, '../../../build/export', `${targetUid}_uploads.zip`);
		const rootDirectory = path.join(__dirname, '../../../public/uploads/');

		const user = require('../index');

		const archive = archiver('zip', {
			zlib: { level: 9 }, // Sets the compression level.
		});

		archive.on('warning', (err) => {
			switch (err.code) {
				case 'ENOENT':
					winston.warn(`[user/export/uploads] File not found: ${err.path}`);
					break;

				default:
					winston.warn(`[user/export/uploads] Unexpected warning: ${err.message}`);
					break;
			}
		});

		archive.on('error', (err) => {
			const trimPath = function (path) {
				return path.replace(rootDirectory, '');
			};
			switch (err.code) {
				case 'EACCES':
					winston.error(`[user/export/uploads] File inaccessible: ${trimPath(err.path)}`);
					break;

				default:
					winston.error(`[user/export/uploads] Unable to construct archive: ${err.message}`);
					break;
			}
		});

		const output = fs.createWriteStream(archivePath);
		output.on('close', async () => {
			await db.close();
			process.exit(0);
		});

		archive.pipe(output);
		winston.verbose(`[user/export/uploads] Collating uploads for uid ${targetUid}`);
		await user.collateUploads(targetUid, archive);

		const profileUploadPath = path.join(nconf.get('upload_path'), `profile/uid-${targetUid}`);
		archive.directory(profileUploadPath, 'profile');
		archive.finalize();
	}
});
