'use strict';

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs').promises;
const assert = require('assert');

const pkgInstall = require('../src/cli/package-install');

describe('Package install lib', () => {
	describe('updatePackageFile()', () => {
		let source;
		const sourcePackagePath = path.resolve(__dirname, '../install/package.json');
		const packageFilePath = path.resolve(__dirname, '../package.json');

		before(async () => {
			// Move `install/package.json` and `package.json` out of the way for now
			await fs.copyFile(sourcePackagePath, path.resolve(__dirname, '../install/package.json.bak')); // safekeeping
			await fs.copyFile(packageFilePath, path.resolve(__dirname, '../package.json.bak')); // safekeeping
			await fs.copyFile(sourcePackagePath, packageFilePath); // match files for testing
		});

		beforeEach(async () => {
			await fs.copyFile(path.resolve(__dirname, '../install/package.json.bak'), sourcePackagePath);
			await fs.copyFile(path.resolve(__dirname, '../package.json.bak'), packageFilePath);
			source = JSON.parse(await fs.readFile(sourcePackagePath));
		});

		it('should remove non-`nodebb-` modules not specified in `install/package.json`', async () => {
			const oldValue = process.env.NODE_ENV;
			process.env.NODE_ENV = 'development';

			// install an extra package
			// chose dotenv because it's a popular package
			// and we use nconf instead
			execSync('npm install dotenv --save');

			// assert it saves in package.json
			const packageWithExtras = JSON.parse(await fs.readFile(packageFilePath, 'utf8'));
			assert(packageWithExtras.dependencies.dotenv, 'dependency did not save');

			// update the package file
			pkgInstall.updatePackageFile();

			// assert it removed the extra package
			const packageCleaned = JSON.parse(await fs.readFile(packageFilePath, 'utf8'));
			assert(!packageCleaned.dependencies.dotenv, 'dependency was not removed');
			process.env.NODE_ENV = oldValue;
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
			source.scripts.postinstall = 'echo "I am a silly bean";';
			await fs.writeFile(packageFilePath, JSON.stringify(source, null, 4));
			delete source.scripts.postinstall;
			source.scripts.preinstall = 'echo "What are you?";';
			await fs.writeFile(sourcePackagePath, JSON.stringify(source, null, 4));
			source.scripts.postinstall = 'echo "I am a silly bean";';

			pkgInstall.updatePackageFile();
			const updated = JSON.parse(await fs.readFile(packageFilePath, 'utf8'));
			assert.deepStrictEqual(updated, source);
			assert.strictEqual(updated.scripts.postinstall, 'echo "I am a silly bean";');
			assert.strictEqual(updated.scripts.preinstall, 'echo "What are you?";');
		});

		after(async () => {
			// Clean up
			await fs.rename(path.resolve(__dirname, '../install/package.json.bak'), sourcePackagePath);
			await fs.rename(path.resolve(__dirname, '../package.json.bak'), packageFilePath);
		});
	});
});
