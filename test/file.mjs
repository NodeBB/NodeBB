import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import nconf from 'nconf';

import utils from '../src/utils.js';
import file from '../src/file.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('file', () => {
	const filename = `${utils.generateUUID()}.png`;
	const folder = 'files';
	const uploadPath = path.join(nconf.get('upload_path'), folder, filename);
	const tempPath = path.join(__dirname, './files/test.png');

	afterEach(async () => {
		await fs.promises.unlink(uploadPath).catch(() => { }); // Ignore errors if file doesn't exist
	});

	describe('copyFile', () => {
		it('should copy a file', async () => {
			await fs.promises.copyFile(tempPath, uploadPath);

			assert(file.existsSync(uploadPath));

			const srcContent = await fs.promises.readFile(tempPath, 'utf8');
			const destContent = await fs.promises.readFile(uploadPath, 'utf8');

			assert.strictEqual(srcContent, destContent);
		});

		it('should override an existing file', async () => {
			await fs.promises.writeFile(uploadPath, 'hsdkjhgkjsfhkgj');

			await fs.promises.copyFile(tempPath, uploadPath);

			assert(file.existsSync(uploadPath));

			const srcContent = await fs.promises.readFile(tempPath, 'utf8');
			const destContent = await fs.promises.readFile(uploadPath, 'utf8');

			assert.strictEqual(srcContent, destContent);
		});

		it('should error if source file does not exist', async () => {
			try {
				await fs.promises.copyFile(`${tempPath}0000000000`, uploadPath);
				assert.fail('Expected an error');
			} catch (err) {
				assert.strictEqual(err.code, 'ENOENT');
			}
		});

		it('should error if existing file is read only', async () => {
			await fs.promises.writeFile(uploadPath, 'hsdkjhgkjsfhkgj');
			await fs.promises.chmod(uploadPath, '444');

			try {
				await fs.promises.copyFile(tempPath, uploadPath);
				assert.fail('Expected an error');
			} catch (err) {
				assert(err.code === 'EPERM' || err.code === 'EACCES');
			}
		});
	});

	describe('saveFileToLocal', () => {
		it('should work', async () => {
			await file.saveFileToLocal(filename, folder, tempPath);

			assert(file.existsSync(uploadPath));

			const oldFile = await fs.promises.readFile(tempPath, 'utf8');
			const newFile = await fs.promises.readFile(uploadPath, 'utf8');
			assert.strictEqual(oldFile, newFile);
		});

		it('should error if source does not exist', async () => {
			try {
				await file.saveFileToLocal(filename, folder, `${tempPath}000000000`);
				assert.fail('Expected an error');
			} catch (err) {
				assert.strictEqual(err.code, 'ENOENT');
			}
		});

		it('should error if folder is relative', async () => {
			try {
				await file.saveFileToLocal(filename, '../../text', `${tempPath}000000000`);
				assert.fail('Expected an error');
			} catch (err) {
				assert.strictEqual(err.message, '[[error:invalid-path]]');
			}
		});
	});

	it('should walk directory', async () => {
		const data = await file.walk(__dirname);
		assert(Array.isArray(data));
	});

	it('should convert mime type to extension', async () => {
		assert.equal(file.typeToExtension('image/png'), '.png');
		assert.equal(file.typeToExtension(''), '');
	});
});