'use strict';

const _ = require('lodash');
const assert = require('assert');
const path = require('path');
const SwaggerParser = require('@apidevtools/swagger-parser');
const file = require('../src/file');

// Bootstrap schema test data
const { execSync } = require('child_process');
execSync('node ./test/api/schema-bootstrap.mjs');

async function runWithoutWindow(fn, filePath) {
	const window = global.window;
	try {
		delete global.window;
		return await fn(filePath);
	} finally {
		global.window = window;
	}
}

describe('API', async () => {
	before(async function () {
		this.readApiPath = path.resolve(__dirname, '../public/openapi/read.yaml');
		this.writeApiPath = path.resolve(__dirname, '../public/openapi/write.yaml');
		this.readApi = await runWithoutWindow(SwaggerParser.dereference, this.readApiPath);
		this.writeApi = await runWithoutWindow(SwaggerParser.dereference, this.writeApiPath);
	});

	it('should pass OpenAPI v3 validation', async function () {
		try {
			await runWithoutWindow(SwaggerParser.validate, this.readApiPath);
			await runWithoutWindow(SwaggerParser.validate, this.writeApiPath);
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
				if (filePath.endsWith('.js')) {
					require(filePath);
				}
			});
		});
	});
});
