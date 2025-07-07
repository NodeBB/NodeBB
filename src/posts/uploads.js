'use strict';

const nconf = require('nconf');
const fs = require('fs').promises;
const crypto = require('crypto');
const path = require('path');
const winston = require('winston');
const mime = require('mime');
const validator = require('validator');
const cronJob = require('cron').CronJob;
const chalk = require('chalk');

const db = require('../database');
const image = require('../image');
const user = require('../user');
const topics = require('../topics');
const file = require('../file');
const meta = require('../meta');

module.exports = function (Posts) {
	Posts.uploads = {};

	const md5 = filename => crypto.createHash('md5').update(filename).digest('hex');
	const pathPrefix = path.join(nconf.get('upload_path'));
	const searchRegex = /\/assets\/uploads(\/files\/[^\s")]+\.?[\w]*)/g;

	const _getFullPath = relativePath => path.join(pathPrefix, relativePath);
	const _filterValidPaths = async filePaths => (await Promise.all(filePaths.map(async (filePath) => {
		const fullPath = _getFullPath(filePath);
		return fullPath.startsWith(pathPrefix) && await file.exists(fullPath) ? filePath : false;
	}))).filter(Boolean);

	const runJobs = nconf.get('runJobs');
	if (runJobs) {
		new cronJob('0 2 * * 0', async () => {
			const orphans = await Posts.uploads.cleanOrphans();
			if (orphans.length) {
				winston.info(`[posts/uploads] Deleting ${orphans.length} orphaned uploads...`);
				orphans.forEach((relPath) => {
					process.stdout.write(`${chalk.red('  - ')} ${relPath}`);
				});
			}
		}, null, true);
	}

	Posts.uploads.sync = async function (pid) {
		// Scans a post's content and updates sorted set of uploads

		const [postData, isMainPost] = await Promise.all([
			Posts.getPostFields(pid, ['content', 'uploads']),
			Posts.isMain(pid),
		]);

		const content = postData.content || '';
		const currentUploads = postData.uploads || [];

		// Extract upload file paths from post content
		let match = searchRegex.exec(content);
		let uploads = new Set();
		while (match) {
			uploads.add(match[1].replace('-resized', ''));
			match = searchRegex.exec(content);
		}

		// Main posts can contain topic thumbs, which are also tracked by pid
		if (isMainPost) {
			const tid = await Posts.getPostField(pid, 'tid');
			let thumbs = await topics.thumbs.get(tid, { thumbsOnly: true });
			thumbs = thumbs.map(thumb => thumb.path).filter(path => !validator.isURL(path, {
				require_protocol: true,
			}));
			thumbs.forEach(t => uploads.add(t));
		}

		uploads = Array.from(uploads);

		// Create add/remove sets
		const add = uploads.filter(path => !currentUploads.includes(path));
		const remove = currentUploads.filter(path => !uploads.includes(path));
		await Posts.uploads.associate(pid, add);
		await Posts.uploads.dissociate(pid, remove);
	};

	Posts.uploads.list = async function (pids) {
		const isArray = Array.isArray(pids);
		if (isArray) {
			const uploads = await Posts.getPostsFields(pids, ['uploads']);
			return uploads.map(p => p.uploads || []);
		}

		const uploads = await Posts.getPostField(pids, 'uploads');
		return uploads;
	};

	Posts.uploads.listWithSizes = async function (pid) {
		const paths = await Posts.uploads.list(pid);
		const sizes = await db.getObjects(paths.map(path => `upload:${md5(path)}`)) || [];

		return sizes.map((sizeObj, idx) => ({
			...sizeObj,
			name: paths[idx],
		}));
	};

	Posts.uploads.getOrphans = async () => {
		let files = await fs.readdir(_getFullPath('/files'));
		files = files.filter(filename => filename !== '.gitignore');

		// Exclude non-timestamped files (e.g. group covers; see gh#10783/gh#10705)
		const tsPrefix = /^\d{13}-/;
		files = files.filter(filename => tsPrefix.test(filename));

		files = await Promise.all(files.map(
			async filename => (await Posts.uploads.isOrphan(`/files/${filename}`) ? `/files/${filename}` : null)
		));
		files = files.filter(Boolean);

		return files;
	};

	Posts.uploads.cleanOrphans = async () => {
		const now = Date.now();
		const expiration = now - (1000 * 60 * 60 * 24 * meta.config.orphanExpiryDays);
		const days = meta.config.orphanExpiryDays;
		if (!days) {
			return [];
		}

		let orphans = await Posts.uploads.getOrphans();

		orphans = await Promise.all(orphans.map(async (relPath) => {
			const { mtimeMs } = await fs.stat(_getFullPath(relPath));
			return mtimeMs < expiration ? relPath : null;
		}));
		orphans = orphans.filter(Boolean);

		await Promise.all(orphans.map(async (relPath) => {
			await file.delete(_getFullPath(relPath));
		}));

		return orphans;
	};

	Posts.uploads.isOrphan = async function (filePath) {
		const length = await db.sortedSetCard(`upload:${md5(filePath)}:pids`);
		return length === 0;
	};

	Posts.uploads.getUsage = async function (filePaths) {
		// Given an array of file names, determines which pids they are used in
		if (!Array.isArray(filePaths)) {
			filePaths = [filePaths];
		}

		// windows path => 'files\\1685368788211-1-profileimg.jpg'
		// linux path => files/1685368788211-1-profileimg.jpg
		// turn them into => '/files/1685368788211-1-profileimg.jpg'
		filePaths.forEach((file) => {
			file.path = `/${file.path.split(path.sep).join(path.posix.sep)}`;
		});

		const keys = filePaths.map(fileObj => `upload:${md5(fileObj.path.replace('-resized', ''))}:pids`);
		return await Promise.all(keys.map(k => db.getSortedSetRange(k, 0, -1)));
	};

	Posts.uploads.associate = async function (pid, filePaths) {
		filePaths = !Array.isArray(filePaths) ? [filePaths] : filePaths;
		if (!filePaths.length) {
			return;
		}
		filePaths = await _filterValidPaths(filePaths); // Only process files that exist and are within uploads directory
		const currentUploads = await Posts.uploads.list(pid);
		filePaths.forEach((path) => {
			if (!currentUploads.includes(path)) {
				currentUploads.push(path);
			}
		});

		const now = Date.now();
		const bulkAdd = filePaths.map(path => [`upload:${md5(path)}:pids`, now, pid]);

		await Promise.all([
			db.setObjectField(`post:${pid}`, 'uploads', JSON.stringify(currentUploads)),
			db.sortedSetAddBulk(bulkAdd),
			Posts.uploads.saveSize(filePaths),
		]);
	};

	Posts.uploads.dissociate = async function (pid, filePaths) {
		filePaths = !Array.isArray(filePaths) ? [filePaths] : filePaths;
		if (!filePaths.length) {
			return;
		}
		let currentUploads = await Posts.uploads.list(pid);
		currentUploads = currentUploads.filter(upload => !filePaths.includes(upload));
		const bulkRemove = filePaths.map(path => [`upload:${md5(path)}:pids`, pid]);
		const promises = [
			db.setObjectField(`post:${pid}`, 'uploads', JSON.stringify(currentUploads)),
			db.sortedSetRemoveBulk(bulkRemove),
		];

		await Promise.all(promises);

		if (!meta.config.preserveOrphanedUploads) {
			const deletePaths = (await Promise.all(
				filePaths.map(async filePath => (await Posts.uploads.isOrphan(filePath) ? filePath : false))
			)).filter(Boolean);

			const uploaderUids = (await db.getObjectsFields(
				deletePaths.map(path => `upload:${md5(path)}`, ['uid'])
			)).map(o => (o ? o.uid || null : null));
			await Promise.all(uploaderUids.map((uid, idx) => (
				uid && isFinite(uid) ? user.deleteUpload(uid, uid, deletePaths[idx]) : null
			)).filter(Boolean));
			await Posts.uploads.deleteFromDisk(deletePaths);
		}
	};

	Posts.uploads.dissociateAll = async (pid) => {
		const current = await Posts.uploads.list(pid);
		await Posts.uploads.dissociate(pid, current);
	};

	Posts.uploads.deleteFromDisk = async (filePaths) => {
		if (typeof filePaths === 'string') {
			filePaths = [filePaths];
		} else if (!Array.isArray(filePaths)) {
			throw new Error(`[[error:wrong-parameter-type, filePaths, ${typeof filePaths}, array]]`);
		}

		filePaths = (await _filterValidPaths(filePaths)).map(_getFullPath);
		await Promise.all(filePaths.map(file.delete));
	};

	Posts.uploads.saveSize = async (filePaths) => {
		filePaths = filePaths.filter((fileName) => {
			const type = mime.getType(fileName);
			return type && type.match(/image./);
		});
		await Promise.all(filePaths.map(async (fileName) => {
			try {
				const size = await image.size(_getFullPath(fileName));
				await db.setObject(`upload:${md5(fileName)}`, {
					width: size.width,
					height: size.height,
				});
			} catch (err) {
				winston.error(`[posts/uploads] Error while saving post upload sizes (${fileName}): ${err.message}`);
			}
		}));
	};
};
