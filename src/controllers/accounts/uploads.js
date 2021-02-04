'use strict';

const nconf = require('nconf');

const db = require('../../database');
const helpers = require('../helpers');
const meta = require('../../meta');
const pagination = require('../../pagination');
const accountHelpers = require('./helpers');

const uploadsController = module.exports;

uploadsController.get = async function (req, res, next) {
	const userData = await accountHelpers.getUserDataByUserSlug(req.params.userslug, req.uid);
	if (!userData) {
		return next();
	}

	const page = Math.max(1, parseInt(req.query.page, 10) || 1);
	const itemsPerPage = 25;
	const start = (page - 1) * itemsPerPage;
	const stop = start + itemsPerPage - 1;
	const [itemCount, uploadNames] = await Promise.all([
		db.sortedSetCard(`uid:${userData.uid}:uploads`),
		db.getSortedSetRevRange(`uid:${userData.uid}:uploads`, start, stop),
	]);

	userData.uploads = uploadNames.map(function (uploadName) {
		return {
			name: uploadName,
			url: nconf.get('upload_url') + uploadName,
		};
	});
	const pageCount = Math.ceil(itemCount / itemsPerPage);
	userData.pagination = pagination.create(page, pageCount, req.query);
	userData.privateUploads = meta.config.privateUploads === 1;
	userData.title = `[[pages:account/uploads, ${userData.username}]]`;
	userData.breadcrumbs = helpers.buildBreadcrumbs([{ text: userData.username, url: `/user/${userData.userslug}` }, { text: '[[global:uploads]]' }]);
	res.render('account/uploads', userData);
};
