'use strict';

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const nconf = require('nconf');
const db = require('../mocks/databasemock');

const user = require('../../src/user');
const topics = require('../../src/topics');
const categories = require('../../src/categories');
const file = require('../../src/file');
const utils = require('../../src/utils');

const md5 = filename => crypto.createHash('md5').update(filename).digest('hex');

describe('uploads.js', () => {
	describe('.associateUpload()', () => {
		let uid;
		let relativePath;

		beforeEach(async () => {
			uid = await user.create({
				username: utils.generateUUID(),
				password: utils.generateUUID(),
				gdpr_consent: 1,
			});
			relativePath = `/files/${utils.generateUUID()}`;

			fs.closeSync(fs.openSync(path.join(nconf.get('upload_path'), relativePath), 'w'));
		});

		it('should associate an uploaded file to a user', async () => {
			await user.associateUpload(uid, relativePath);
			const uploads = await db.getSortedSetMembers(`uid:${uid}:uploads`);
			const uploadObj = await db.getObject(`upload:${md5(relativePath)}`);

			assert.strictEqual(uploads.length, 1);
			assert.deepStrictEqual(uploads, [relativePath]);
			assert.strictEqual(parseInt(uploadObj.uid, 10), uid);
		});

		it('should throw an error if the path is invalid', async () => {
			try {
				await user.associateUpload(uid, `${relativePath}suffix`);
			} catch (e) {
				assert(e);
				assert.strictEqual(e.message, '[[error:invalid-path]]');
			}

			const uploads = await db.getSortedSetMembers(`uid:${uid}:uploads`);

			assert.strictEqual(uploads.length, 0);
			assert.deepStrictEqual(uploads, []);
		});

		it('should guard against path traversal', async () => {
			try {
				await user.associateUpload(uid, `../../config.json`);
			} catch (e) {
				assert(e);
				assert.strictEqual(e.message, '[[error:invalid-path]]');
			}

			const uploads = await db.getSortedSetMembers(`uid:${uid}:uploads`);

			assert.strictEqual(uploads.length, 0);
			assert.deepStrictEqual(uploads, []);
		});
	});

	describe('.deleteUpload', () => {
		let uid;
		let relativePath;

		beforeEach(async () => {
			uid = await user.create({
				username: utils.generateUUID(),
				password: utils.generateUUID(),
				gdpr_consent: 1,
			});
			relativePath = `/files/${utils.generateUUID()}`;

			fs.closeSync(fs.openSync(path.join(nconf.get('upload_path'), relativePath), 'w'));
			await user.associateUpload(uid, relativePath);
		});

		it('should remove the upload from the user\'s uploads zset', async () => {
			await user.deleteUpload(uid, uid, relativePath);

			const uploads = await db.getSortedSetMembers(`uid:${uid}:uploads`);
			assert.deepStrictEqual(uploads, []);
		});

		it('should delete the file from disk', async () => {
			let exists = await file.exists(`${nconf.get('upload_path')}/${relativePath}`);
			assert.strictEqual(exists, true);

			await user.deleteUpload(uid, uid, relativePath);

			exists = await file.exists(`${nconf.get('upload_path')}/${relativePath}`);
			assert.strictEqual(exists, false);
		});

		it('should clean up references to it from the database', async () => {
			const hash = md5(relativePath);
			let exists = await db.exists(`upload:${hash}`);
			assert.strictEqual(exists, true);

			await user.deleteUpload(uid, uid, relativePath);
			exists = await db.exists(`upload:${hash}`);
			assert.strictEqual(exists, false);
		});

		it('should accept multiple paths', async () => {
			const secondPath = `/files/${utils.generateUUID()}`;
			fs.closeSync(fs.openSync(path.join(nconf.get('upload_path'), secondPath), 'w'));
			await user.associateUpload(uid, secondPath);

			assert.strictEqual(await db.sortedSetCard(`uid:${uid}:uploads`), 2);

			await user.deleteUpload(uid, uid, [relativePath, secondPath]);

			assert.strictEqual(await db.sortedSetCard(`uid:${uid}:uploads`), 0);
			assert.deepStrictEqual(await db.getSortedSetMembers(`uid:${uid}:uploads`), []);
		});

		it('should throw an error on a non-existant file', async () => {
			try {
				await user.deleteUpload(uid, uid, `${relativePath}asdbkas`);
			} catch (e) {
				assert(e);
				assert.strictEqual(e.message, '[[error:invalid-path]]');
			}
		});

		it('should guard against path traversal', async () => {
			assert.strictEqual(await file.exists(path.resolve(nconf.get('upload_path'), '../../config.json')), true);

			try {
				await user.deleteUpload(uid, uid, `../../config.json`);
			} catch (e) {
				assert(e);
				assert.strictEqual(e.message, '[[error:invalid-path]]');
			}
		});

		it('should remove the post association as well, if present', async () => {
			const { cid } = await categories.create({ name: utils.generateUUID() });
			const { postData } = await topics.post({
				uid,
				cid,
				title: utils.generateUUID(),
				content: `[an upload](/assets/uploads${relativePath})`,
			});

			assert.deepStrictEqual(await db.getSortedSetMembers(`upload:${md5(relativePath)}:pids`), [postData.pid.toString()]);

			await user.deleteUpload(uid, uid, relativePath);

			assert.strictEqual(await db.exists(`upload:${md5(relativePath)}:pids`), false);
		});
	});
});
