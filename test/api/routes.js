'use strict';

const assert = require('assert');
const path = require('path');
const nconf = require('nconf');
const _ = require('lodash');
const SwaggerParser = require('@apidevtools/swagger-parser');

const db = require('../mocks/databasemock');

let readApi;
let writeApi;

describe('routes', function () {
	before(async function () {
		const readApiPath = path.resolve(__dirname, '../../public/openapi/read.yaml');
		const writeApiPath = path.resolve(__dirname, '../../public/openapi/write.yaml');
		readApi = await SwaggerParser.dereference(readApiPath);
		writeApi = await SwaggerParser.dereference(writeApiPath);
	});

	it('should grab all mounted routes and ensure a schema exists', async function () {
		const webserver = require('../../src/webserver');
		const buildPaths = function (stack, prefix) {
			const paths = stack.map((dispatch) => {
				if (dispatch.route && dispatch.route.path && typeof dispatch.route.path === 'string') {
					if (!prefix && !dispatch.route.path.startsWith('/api/')) {
						return null;
					}

					if (prefix === nconf.get('relative_path')) {
						prefix = '';
					}

					return {
						method: Object.keys(dispatch.route.methods)[0],
						path: (prefix || '') + dispatch.route.path,
					};
				} else if (dispatch.name === 'router') {
					const prefix = dispatch.regexp.toString().replace('/^', '').replace('\\/?(?=\\/|$)/i', '').replace(/\\\//g, '/');
					return buildPaths(dispatch.handle.stack, prefix);
				}

				// Drop any that aren't actual routes (middlewares, error handlers, etc.)
				return null;
			});

			return _.flatten(paths);
		};

		let paths = buildPaths(webserver.app._router.stack).filter(Boolean).map((pathObj) => {
			pathObj.path = pathObj.path.replace(/\/:([^\\/]+)/g, '/{$1}');
			return pathObj;
		});
		const exclusionPrefixes = [
			'/api/admin/plugins', '/api/compose', '/debug',
			'/api/user/{userslug}/theme', // from persona
		];
		paths = paths.filter(path => path.method !== '_all' && !exclusionPrefixes.some(prefix => path.path.startsWith(prefix)));


		// For each express path, query for existence in read and write api schemas
		paths.forEach((pathObj) => {
			describe(`${pathObj.method.toUpperCase()} ${pathObj.path}`, function () {
				it('should be defined in schema docs', function () {
					let schema = readApi;
					if (pathObj.path.startsWith('/api/v3')) {
						schema = writeApi;
						pathObj.path = pathObj.path.replace('/api/v3', '');
					}

					// Don't check non-GET routes in Read API
					if (schema === readApi && pathObj.method !== 'get') {
						return;
					}

					const normalizedPath = pathObj.path.replace(/\/:([^\\/]+)/g, '/{$1}').replace(/\?/g, '');
					assert(schema.paths.hasOwnProperty(normalizedPath), `${pathObj.path} is not defined in schema docs`);
					assert(schema.paths[normalizedPath].hasOwnProperty(pathObj.method), `${pathObj.path} was found in schema docs, but ${pathObj.method.toUpperCase()} method is not defined`);
				});
			});
		});
	});
});