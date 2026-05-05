'use strict';

const _ = require('lodash');
const assert = require('assert');
const path = require('path');
const fs = require('fs');
const SwaggerParser = require('@apidevtools/swagger-parser');
const nconf = require('nconf');
const jwt = require('jsonwebtoken');
const util = require('util');

const wait = util.promisify(setTimeout);

const db = require('./mocks/databasemock');
const request = require('../src/request');
const helpers = require('./helpers');
const meta = require('../src/meta');
const file = require('../src/file');
const user = require('../src/user');
const groups = require('../src/groups');
const categories = require('../src/categories');
const topics = require('../src/topics');
const posts = require('../src/posts');
const plugins = require('../src/plugins');
const flags = require('../src/flags');
const messaging = require('../src/messaging');
const activitypub = require('../src/activitypub');
const notifications = require('../src/notifications');
const utils = require('../src/utils');
const api = require('../src/api');

describe('API', async () => {
	before(async function () {
		this.readApiPath = path.resolve(__dirname, '../public/openapi/read.yaml');
		this.writeApiPath = path.resolve(__dirname, '../public/openapi/write.yaml');
		this.readApi = await SwaggerParser.dereference(this.readApiPath);
		this.writeApi = await SwaggerParser.dereference(this.writeApiPath);
	});

	it.skip('should pass OpenAPI v3 validation', async function () {
		try {
			await SwaggerParser.validate(this.readApiPath);
			await SwaggerParser.validate(this.writeApiPath);
		} catch (e) {
			assert.ifError(e);
		}
	});

	describe('API', async () => {
		let files;

		before(async () => {
			files = await file.walk(path.resolve(__dirname, './api'));
		});

		it('subfolder tests', () => {
			files.forEach((filePath) => {
				require(filePath);
			});
		});
	});
});
