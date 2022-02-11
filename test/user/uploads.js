'use strict';

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const nconf = require('nconf');
const db = require('../mocks/databasemock');

const user = require('../../src/user');
const utils = require('../../public/src/utils');

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
			relativePath = `files/${utils.generateUUID()}`;

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
			relativePath = `files/${utils.generateUUID()}`;

			fs.closeSync(fs.openSync(path.join(nconf.get('upload_path'), relativePath), 'w'));
			await user.associateUpload(uid, relativePath);
		});

		it('should remove the upload from the user\'s uploads zset', async () => {

		});

		it('should delete the file from disk', async () => {

		});

		it('should clean up references to it from the database', async () => {

		});

		it('should accept multiple paths', async () => {

		});

		it('should throw an error on a non-existant file', async () => {

		});

		it('should guard against path traversal', async () => {

		});
	});
});
