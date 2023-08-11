'use strict';

const path = require('path');
const nconf = require('nconf');
const fs = require('fs');

const meta = require('../../meta');
const posts = require('../../posts');
const file = require('../../file');
const image = require('../../image');
const plugins = require('../../plugins');
const pagination = require('../../pagination');

const allowedImageTypes = ['image/png', 'image/jpeg', 'image/pjpeg', 'image/jpg', 'image/gif', 'image/svg+xml'];

const uploadsController = module.exports;

uploadsController.get = async function (req, res, next) {
	const currentFolder = path.join(nconf.get('upload_path'), req.query.dir || '');
	if (!currentFolder.startsWith(nconf.get('upload_path'))) {
		return next(new Error('[[error:invalid-path]]'));
	}
	const itemsPerPage = 20;
	const page = parseInt(req.query.page, 10) || 1;
	try {
		let files = await fs.promises.readdir(currentFolder);
		files = files.filter(filename => filename !== '.gitignore');
		const itemCount = files.length;
		const start = Math.max(0, (page - 1) * itemsPerPage);
		const stop = start + itemsPerPage;
		files = files.slice(start, stop);

		files = await filesToData(currentFolder, files);

		// Float directories to the top
		files.sort((a, b) => {
			if (a.isDirectory && !b.isDirectory) {
				return -1;
			} else if (!a.isDirectory && b.isDirectory) {
				return 1;
			} else if (!a.isDirectory && !b.isDirectory) {
				return a.mtime < b.mtime ? -1 : 1;
			}

			return 0;
		});

		// Add post usage info if in /files
		if (['files', '/files', '/files/'].includes(req.query.dir)) {
			const usage = await posts.uploads.getUsage(files);
			files.forEach((file, idx) => {
				file.inPids = usage[idx].map(pid => parseInt(pid, 10));
			});
		}
		res.render('admin/manage/uploads', {
			currentFolder: currentFolder.replace(nconf.get('upload_path'), ''),
			showPids: files.length && files[0].hasOwnProperty('inPids'),
			files: files,
			breadcrumbs: buildBreadcrumbs(currentFolder),
			pagination: pagination.create(page, Math.ceil(itemCount / itemsPerPage), req.query),
		});
	} catch (err) {
		next(err);
	}
};

function buildBreadcrumbs(currentFolder) {
	const crumbs = [];
	const parts = currentFolder.replace(nconf.get('upload_path'), '').split(path.sep);
	let currentPath = '';
	parts.forEach((part, i) => {
		const dir = path.join(currentPath, part);
		const crumb = {
			text: part || 'Uploads',
		};
		if (i < parts.length - 1) {
			crumb.url = part ?
				(`${nconf.get('relative_path')}/admin/manage/uploads?dir=${dir}`) :
				`${nconf.get('relative_path')}/admin/manage/uploads`;
		}
		crumbs.push(crumb);
		currentPath = dir;
	});

	return crumbs;
}

async function filesToData(currentDir, files) {
	return await Promise.all(files.map(file => getFileData(currentDir, file)));
}

async function getFileData(currentDir, file) {
	const pathToFile = path.join(currentDir, file);
	const stat = await fs.promises.stat(pathToFile);
	let filesInDir = [];
	if (stat.isDirectory()) {
		filesInDir = await fs.promises.readdir(pathToFile);
	}
	const url = `${nconf.get('upload_url') + currentDir.replace(nconf.get('upload_path'), '')}/${file}`;
	return {
		name: file,
		path: pathToFile.replace(path.join(nconf.get('upload_path'), '/'), ''),
		url: url,
		fileCount: Math.max(0, filesInDir.length - 1), // ignore .gitignore
		size: stat.size,
		sizeHumanReadable: `${(stat.size / 1024).toFixed(1)}KiB`,
		isDirectory: stat.isDirectory(),
		isFile: stat.isFile(),
		mtime: stat.mtimeMs,
	};
}

uploadsController.uploadCategoryPicture = async function (req, res, next) {
	const uploadedFile = req.files.files[0];
	let params = null;

	try {
		params = JSON.parse(req.body.params);
	} catch (e) {
		file.delete(uploadedFile.path);
		return next(new Error('[[error:invalid-json]]'));
	}

	await validateUpload(uploadedFile, allowedImageTypes);
	const filename = `category-${params.cid}${path.extname(uploadedFile.name)}`;
	await uploadImage(filename, 'category', uploadedFile, req, res, next);
};

uploadsController.uploadFavicon = async function (req, res, next) {
	const uploadedFile = req.files.files[0];
	const allowedTypes = ['image/x-icon', 'image/vnd.microsoft.icon'];

	await validateUpload(uploadedFile, allowedTypes);
	try {
		const imageObj = await file.saveFileToLocal('favicon.ico', 'system', uploadedFile.path);
		res.json([{ name: uploadedFile.name, url: imageObj.url }]);
	} catch (err) {
		next(err);
	} finally {
		file.delete(uploadedFile.path);
	}
};

uploadsController.uploadTouchIcon = async function (req, res, next) {
	const uploadedFile = req.files.files[0];
	const allowedTypes = ['image/png'];
	const sizes = [36, 48, 72, 96, 144, 192, 512];

	await validateUpload(uploadedFile, allowedTypes);
	try {
		const imageObj = await file.saveFileToLocal('touchicon-orig.png', 'system', uploadedFile.path);
		// Resize the image into squares for use as touch icons at various DPIs
		for (const size of sizes) {
			/* eslint-disable no-await-in-loop */
			await image.resizeImage({
				path: uploadedFile.path,
				target: path.join(nconf.get('upload_path'), 'system', `touchicon-${size}.png`),
				width: size,
				height: size,
			});
		}
		res.json([{ name: uploadedFile.name, url: imageObj.url }]);
	} catch (err) {
		next(err);
	} finally {
		file.delete(uploadedFile.path);
	}
};


uploadsController.uploadMaskableIcon = async function (req, res, next) {
	const uploadedFile = req.files.files[0];
	const allowedTypes = ['image/png'];

	await validateUpload(uploadedFile, allowedTypes);
	try {
		const imageObj = await file.saveFileToLocal('maskableicon-orig.png', 'system', uploadedFile.path);
		res.json([{ name: uploadedFile.name, url: imageObj.url }]);
	} catch (err) {
		next(err);
	} finally {
		file.delete(uploadedFile.path);
	}
};

uploadsController.uploadLogo = async function (req, res, next) {
	await upload('site-logo', req, res, next);
};

uploadsController.uploadFile = async function (req, res, next) {
	const uploadedFile = req.files.files[0];
	let params;
	try {
		params = JSON.parse(req.body.params);
	} catch (e) {
		file.delete(uploadedFile.path);
		return next(new Error('[[error:invalid-json]]'));
	}

	try {
		const data = await file.saveFileToLocal(uploadedFile.name, params.folder, uploadedFile.path);
		res.json([{ url: data.url }]);
	} catch (err) {
		next(err);
	} finally {
		file.delete(uploadedFile.path);
	}
};

uploadsController.uploadDefaultAvatar = async function (req, res, next) {
	await upload('avatar-default', req, res, next);
};

uploadsController.uploadOgImage = async function (req, res, next) {
	await upload('og:image', req, res, next);
};

async function upload(name, req, res, next) {
	const uploadedFile = req.files.files[0];

	await validateUpload(uploadedFile, allowedImageTypes);
	const filename = name + path.extname(uploadedFile.name);
	await uploadImage(filename, 'system', uploadedFile, req, res, next);
}

async function validateUpload(uploadedFile, allowedTypes) {
	if (!allowedTypes.includes(uploadedFile.type)) {
		file.delete(uploadedFile.path);
		throw new Error(`[[error:invalid-image-type, ${allowedTypes.join('&#44; ')}]]`);
	}
}

async function uploadImage(filename, folder, uploadedFile, req, res, next) {
	let imageData;
	try {
		if (plugins.hooks.hasListeners('filter:uploadImage')) {
			imageData = await plugins.hooks.fire('filter:uploadImage', { image: uploadedFile, uid: req.uid, folder: folder });
		} else {
			imageData = await file.saveFileToLocal(filename, folder, uploadedFile.path);
		}

		if (path.basename(filename, path.extname(filename)) === 'site-logo' && folder === 'system') {
			const uploadPath = path.join(nconf.get('upload_path'), folder, 'site-logo-x50.png');
			await image.resizeImage({
				path: uploadedFile.path,
				target: uploadPath,
				height: 50,
			});
			await meta.configs.set('brand:emailLogo', path.join(nconf.get('upload_url'), 'system/site-logo-x50.png'));
			const size = await image.size(uploadedFile.path);
			await meta.configs.setMultiple({
				'brand:logo:width': size.width,
				'brand:logo:height': size.height,
			});
		} else if (path.basename(filename, path.extname(filename)) === 'og:image' && folder === 'system') {
			const size = await image.size(uploadedFile.path);
			await meta.configs.setMultiple({
				'og:image:width': size.width,
				'og:image:height': size.height,
			});
		}
		res.json([{ name: uploadedFile.name, url: imageData.url.startsWith('http') ? imageData.url : nconf.get('relative_path') + imageData.url }]);
	} catch (err) {
		next(err);
	} finally {
		file.delete(uploadedFile.path);
	}
}
