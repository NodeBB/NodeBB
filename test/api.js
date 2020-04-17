'use strict';

const assert = require('assert');
const path = require('path');
const SwaggerParser = require('@apidevtools/swagger-parser');

describe('Read API', () => {
	let readApi;

	it('should pass OpenAPI v3 validation', async () => {
		const apiPath = path.resolve(__dirname, '../public/openapi/read.yaml');
		try {
			readApi = await SwaggerParser.validate(apiPath);
		} catch (e) {
			assert.ifError(e);
		}
	});
});

describe('Write API', () => {
	let writeApi;
});
