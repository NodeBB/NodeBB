'use strict';

const path = require('path');
const fs = require('fs').promises;
const assert = require('assert');

const pkgInstall = require('../src/cli/package-install');

describe('Package install lib', () => {
	/**
	 * Important:
	 *   - The tests here have a beforeEach() run prior to each test, it resets
	 *     package.json and install/package.json back to identical states.
	 *   - Update `source` and `current` for testing.
	 */
	describe('updatePackageFile()', () => {
		let source;
		let current;
		const sourcePackagePath = path.resolve(__dirname, '../install/package.json');
		const packageFilePath = path.resolve(__dirname, '../package.json');

		before(async () => {
			// Move `install/package.json` and `package.json` out of the way for now
			await fs.copyFile(sourcePackagePath, path.resolve(__dirname, '../install/package.json.bak')); // safekeeping
			await fs.copyFile(packageFilePath, path.resolve(__dirname, '../package.json.bak')); // safekeeping
		});

		beforeEach(async () => {
			await fs.copyFile(path.resolve(__dirname, '../install/package.json.bak'), sourcePackagePath);
			await fs.copyFile(sourcePackagePath, packageFilePath); // match files for testing
			source = JSON.parse(await fs.readFile(sourcePackagePath));
			current = JSON.parse(await fs.readFile(packageFilePath));
		});

		it('should remove non-`nodebb-` modules not specified in `install/package.json`', async () => {
			source.dependencies.dotenv = '16.0.0';
			await fs.writeFile(packageFilePath, JSON.stringify(source, null, 4));
			delete source.dependencies.dotenv;

			pkgInstall.updatePackageFile();

			// assert it removed the extra package
			const packageCleaned = JSON.parse(await fs.readFile(packageFilePath, 'utf8'));
			assert(!packageCleaned.dependencies.dotenv, 'dependency was not removed');
		});

		it('should merge new root level properties from `install/package.json` into `package.json`', async () => {
			source.bin = './nodebb';
			await fs.writeFile(sourcePackagePath, JSON.stringify(source, null, 4));

			pkgInstall.updatePackageFile();
			const updated = JSON.parse(await fs.readFile(packageFilePath, 'utf8'));
			assert.deepStrictEqual(updated, source);
		});

		it('should add new dependencies', async () => {
			source.dependencies['nodebb-plugin-foobar'] = '1.0.0';
			await fs.writeFile(sourcePackagePath, JSON.stringify(source, null, 4));

			pkgInstall.updatePackageFile();
			const updated = JSON.parse(await fs.readFile(packageFilePath, 'utf8'));
			assert.deepStrictEqual(updated, source);
		});

		it('should update version on dependencies', async () => {
			source.dependencies['nodebb-plugin-mentions'] = '1.0.0';
			await fs.writeFile(sourcePackagePath, JSON.stringify(source, null, 4));

			pkgInstall.updatePackageFile();
			const updated = JSON.parse(await fs.readFile(packageFilePath, 'utf8'));
			assert.deepStrictEqual(updated, source);
		});

		it('should deep merge nested objects', async () => {
			current.scripts.postinstall = 'echo "I am a silly bean";';
			await fs.writeFile(packageFilePath, JSON.stringify(current, null, 4));
			source.scripts.preinstall = 'echo "What are you?";';
			await fs.writeFile(sourcePackagePath, JSON.stringify(source, null, 4));
			source.scripts.postinstall = 'echo "I am a silly bean";';

			pkgInstall.updatePackageFile();
			const updated = JSON.parse(await fs.readFile(packageFilePath, 'utf8'));
			assert.deepStrictEqual(updated, source);
			assert.strictEqual(updated.scripts.postinstall, 'echo "I am a silly bean";');
			assert.strictEqual(updated.scripts.preinstall, 'echo "What are you?";');
		});

		it('should remove extraneous devDependencies', async () => {
			current.devDependencies.expect = '27.5.1';
			await fs.writeFile(packageFilePath, JSON.stringify(current, null, 4));

			pkgInstall.updatePackageFile();
			const updated = JSON.parse(await fs.readFile(packageFilePath, 'utf8'));
			assert.strictEqual(updated.devDependencies.hasOwnProperty('expect'), false);
		});

		it('should handle if there is no package.json', async () => {
			await fs.unlink(packageFilePath);

			pkgInstall.updatePackageFile();
			const updated = JSON.parse(await fs.readFile(packageFilePath, 'utf8'));
			assert.deepStrictEqual(updated, source);
		});

		after(async () => {
			// Clean up
			await fs.rename(path.resolve(__dirname, '../install/package.json.bak'), sourcePackagePath);
			await fs.rename(path.resolve(__dirname, '../package.json.bak'), packageFilePath);
		});
	});
});
