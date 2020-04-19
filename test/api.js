'use strict';

const assert = require('assert');
const path = require('path');
const SwaggerParser = require('@apidevtools/swagger-parser');
const request = require('request-promise-native');
const nconf = require('nconf');

const db = require('./mocks/databasemock');
const helpers = require('./helpers');
const user = require('../src/user');
const groups = require('../src/groups');
const categories = require('../src/categories');
const topics = require('../src/topics');
const posts = require('../src/posts');

describe('Read API', async () => {
	let readApi = false;
	const apiPath = path.resolve(__dirname, '../public/openapi/read.yaml');

	it('should pass OpenAPI v3 validation', async () => {
		try {
			await SwaggerParser.validate(apiPath);
		} catch (e) {
			assert.ifError(e);
		}
	});

	readApi = await SwaggerParser.dereference(apiPath);

	// Iterate through all documented paths, make a call to it, and compare the result body with what is defined in the spec
	const paths = Object.keys(readApi.paths);

	paths.forEach((path) => {
		let schema;
		let response;
		let url;

		function compare(schema, response, context) {
			let required = schema.required;
			if (schema.allOf) {
				schema = schema.allOf.reduce((memo, obj) => {
					memo = { ...memo, ...obj.properties };
					return memo;
				}, {});
			} else if (schema.properties) {
				schema = schema.properties;
			} else {
				// If schema contains no properties, check passes
				return;
			}

			if (!required) {
				required = Object.keys(schema);
			}

			// TODO: If `required` present, iterate through that, otherwise iterate through all
			required.forEach((prop) => {
				if (schema.hasOwnProperty(prop)) {
					assert(response.hasOwnProperty(prop), '"' + prop + '" is a required property (path: ' + path + ', context: ' + context + ')');

					// Don't proceed with type-check if the value could possibly be unset (nullable: true, in spec)
					if (response[prop] === null && schema[prop].nullable === true) {
						return;
					}

					switch (schema[prop].type) {
					case 'string':
						assert.strictEqual(typeof response[prop], 'string', '"' + prop + '" was expected to be a string, but was ' + typeof response[prop] + ' instead (path: ' + path + ', context: ' + context + ')');
						break;
					case 'boolean':
						assert.strictEqual(typeof response[prop], 'boolean', '"' + prop + '" was expected to be a boolean, but was ' + typeof response[prop] + ' instead (path: ' + path + ', context: ' + context + ')');
						break;
					case 'object':
						assert.strictEqual(typeof response[prop], 'object', '"' + prop + '" was expected to be an object, but was ' + typeof response[prop] + ' instead (path: ' + path + ', context: ' + context + ')');
						compare(schema[prop], response[prop], context ? [context, prop].join('.') : prop);
						break;
					case 'array':
						assert.strictEqual(Array.isArray(response[prop]), true, '"' + prop + '" was expected to be an array, but was ' + typeof response[prop] + ' instead (path: ' + path + ', context: ' + context + ')');

						if (schema[prop].items) {
							// Ensure the array items have a schema defined
							assert(schema[prop].items.type || schema[prop].items.allOf, '"' + prop + '" is defined to be an array, but its items have no schema defined (path: ' + path + ', context: ' + context + ')');

							// Compare types
							if (schema[prop].items.type === 'object' || Array.isArray(schema[prop].items.allOf)) {
								response[prop].forEach((res) => {
									compare(schema[prop].items, res, context ? [context, prop].join('.') : prop);
								});
							} else if (response[prop].length) { // for now
								response[prop].forEach((item) => {
									assert.strictEqual(typeof item, schema[prop].items.type, '"' + prop + '" should have ' + schema[prop].items.type + ' items, but found ' + typeof items + ' instead (path: ' + path + ', context: ' + context + ')');
								});
							}
						}
						break;
					}
				}
			});
		}

		it('should have examples when parameters are present', () => {
			const parameters = readApi.paths[path].get.parameters;
			let testPath = path;
			if (parameters) {
				parameters.forEach((param) => {
					assert(param.example, path + ' has parameters without examples');
					testPath = testPath.replace('{' + param.name + '}', param.example);
				});
			}

			url = nconf.get('url') + testPath;
		});

		it('should resolve with a 200 when called', async () => {
			// Create admin user
			const adminUid = await user.create({ username: 'admin', password: '123456' });
			await groups.join('administrators', adminUid);

			// Create a category
			const testCategory = await categories.create({ name: 'test' });

			// Post a new topic
			const testTopic = await topics.post({
				uid: adminUid,
				cid: testCategory.cid,
				title: 'Test Topic',
				content: 'Test topic content',
			});

			const jar = await helpers.loginUser('admin', '123456');
			try {
				response = await request(url, {
					jar: jar,
					json: true,
				});
			} catch (e) {
				assert(!e, path + ' resolved with ' + e.message);
			}
		});

		// Recursively iterate through schema properties, comparing type
		it('response should match schema definition', () => {
			if (readApi.paths[path].get.responses['200']) {
				schema = readApi.paths[path].get.responses['200'].content['application/json'].schema;
				compare(schema, response, 'root');
			}
		});
	});
});

describe('Write API', () => {
	let writeApi;
});
