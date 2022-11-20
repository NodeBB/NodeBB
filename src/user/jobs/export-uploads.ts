'use strict';

import nconf from 'nconf';

nconf.argv().env({
	separator: '__',
});

import * as fs from 'fs';
import path from 'path';const archiver = require('archiver');
import winston from 'winston';

(process as any).env.NODE_ENV = (process as any).env.NODE_ENV || 'production';

// Alternate configuration file support
const configFile = path.resolve(__dirname, '../../../', nconf.any(['config', 'CONFIG']) || 'config.json');
const prestart = require('../../prestart');

prestart.loadConfig(configFile);
prestart.setupWinston();

import db from '../../database';

(process as any).on('message', async (msg: any) => {
	if (msg && msg.uid) {
		await db.init();

		const targetUid = msg.uid;

		const archivePath = path.join(__dirname, '../../../build/export', `${targetUid}_uploads.zip`);
		const rootDirectory = path.join(__dirname, '../../../../public/uploads/');

		const user = require('../index');

		const archive = archiver('zip', {
			zlib: { level: 9 }, // Sets the compression level.
		});

		archive.on('warning', (err) => {
			switch ((err as any).code) {
				case 'ENOENT':
					winston.warn(`[user/export/uploads] File not found: ${(err as any).path}`);
					break;

				default:
					winston.warn(`[user/export/uploads] Unexpected warning: ${err.message}`);
					break;
			}
		});

		archive.on('error', (err) => {
			const trimPath = function (path: string) {
				return path.replace(rootDirectory, '');
			};
			switch ((err as any).code) {
				case 'EACCES':
					winston.error(`[user/export/uploads] File inaccessible: ${trimPath((err as any).path)}`);
					break;

				default:
					winston.error(`[user/export/uploads] Unable to construct archive: ${err.message}`);
					break;
			}
		});

		const output = fs.createWriteStream(archivePath);
		output.on('close', async () => {
			await db.close();
			(process as any).exit(0);
		});

		archive.pipe(output);
		winston.verbose(`[user/export/uploads] Collating uploads for uid ${targetUid}`);
		await user.collateUploads(targetUid, archive);

		const uploadedPicture = await user.getUserField(targetUid, 'uploadedpicture');
		if (uploadedPicture) {
			const filePath = uploadedPicture.replace(nconf.get('upload_url'), '');
			archive.file(path.join(nconf.get('upload_path'), filePath), {
				name: path.basename(filePath),
			});
		}

		archive.finalize();
	}
});
