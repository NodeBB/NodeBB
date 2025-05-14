import assert from 'assert';
import path from 'path';
import { fileURLToPath } from 'url';

import './mocks/databasemock.mjs';
import image from '../src/image.js';
import file from '../src/file.js';

// ESM equivalent of __dirname
const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('image', () => {
	it('should normalise image', async () => {
		await image.normalise(path.join(__dirname, 'files/normalise.jpg'), '.jpg');
		const exists = await file.exists(path.join(__dirname, 'files/normalise.jpg.png'));
		assert(exists);
	});

	it('should resize an image', async () => {
		await image.resizeImage({
			path: path.join(__dirname, 'files/normalise.jpg'),
			target: path.join(__dirname, 'files/normalise-resized.jpg'),
			width: 50,
			height: 40,
		});
		const bitmap = await image.size(path.join(__dirname, 'files/normalise-resized.jpg'));
		assert.equal(bitmap.width, 50);
		assert.equal(bitmap.height, 40);
	});
});