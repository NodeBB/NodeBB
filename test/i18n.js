'use strict';

// For tests relating to the translator module, check translator.js

const assert = require('assert');
const path = require('path');
const fs = require('fs');

const file = require('../src/file');

const db = require('./mocks/databasemock');

describe('i18n', () => {
	let folders;

	before(async () => {
		folders = await fs.promises.readdir(path.resolve(__dirname, '../public/language'));
		folders.shift();	// remove README.md from list of folders to check
	});

	it('should contain folders named after the language code', async () => {
		const valid = /(?:README.md|^[a-z]{2}(?:-[A-Z]{2})?$|^[a-z]{2}(?:-x-[a-z]+)?$)/;	// good luck

		folders.forEach((folder) => {
			assert(valid.test(folder));
		});
	});

	// There has to be a better way to generate tests asynchronously...
	it('', async () => {
		const sourcePath = path.resolve(__dirname, '../public/language/en-GB');
		const fullPaths = await file.walk(sourcePath);
		const sourceFiles = fullPaths.map(path => path.replace(sourcePath, ''));
		const sourceStrings = new Map();

		describe('source language file structure', () => {
			it('should only contain valid JSON files', async () => {
				try {
					fullPaths.forEach((fullPath) => {
						const hash = require(fullPath);
						sourceStrings.set(fullPath.replace(sourcePath, ''), hash);
					});
				} catch (e) {
					assert(!e, `Invalid JSON found: ${e.message}`);
				}
			});
		});

		folders.forEach((language) => {
			describe(`"${language}" file structure`, () => {
				let files;

				before(async () => {
					const translationPath = path.resolve(__dirname, `../public/language/${language}`);
					files = (await file.walk(translationPath)).map(path => path.replace(translationPath, ''));
				});

				it('translations should contain every language file contained in the source language directory', () => {
					sourceFiles.forEach((relativePath) => {
						assert(files.includes(relativePath), `${relativePath.slice(1)} was found in source files but was not found in language "${language}" (likely not internationalized)`);
					});
				});

				it('should not contain any extraneous files not included in the source language directory', () => {
					files.forEach((relativePath) => {
						assert(sourceFiles.includes(relativePath), `${relativePath.slice(1)} was found in language "${language}" but there is no source file for it (likely removed from en-GB)`);
					});
				});
			});

			describe(`"${language}" file contents`, () => {
				let fullPaths;
				const translationPath = path.resolve(__dirname, `../public/language/${language}`);
				const strings = new Map();

				before(async () => {
					fullPaths = await file.walk(translationPath);
				});

				it('should contain only valid JSON files', () => {
					try {
						fullPaths.forEach((fullPath) => {
							const hash = require(fullPath);
							strings.set(fullPath.replace(translationPath, ''), hash);
						});
					} catch (e) {
						assert(!e, `Invalid JSON found: ${e.message}`);
					}
				});

				it('should contain every translation key contained in its source counterpart', () => {
					const sourceArr = Array.from(sourceStrings.keys());
					sourceArr.forEach((namespace) => {
						const sourceKeys = Object.keys(sourceStrings.get(namespace));
						const translationKeys = Object.keys(strings.get(namespace));

						assert(sourceKeys && translationKeys);
						sourceKeys.forEach((key) => {
							assert(translationKeys.includes(key), `${namespace.slice(1, -5)}:${key} missing in ${language}`);
						});
						assert.strictEqual(sourceKeys.length, translationKeys.length, `Extra keys found in namespace ${namespace.slice(1, -5)} for language "${language}"`);
					});
				});
			});
		});
	});
});
