'use strict';

const path = require('path');

const nconf = require('nconf');

const db = require('../../database');
const helpers = require('../helpers');
const user = require('../../user');
const meta = require('../../meta');
const pagination = require('../../pagination');

const uploadsController = module.exports;

uploadsController.get = async function (req, res) {
	const { username, userslug } = await user.getUserFields(res.locals.uid, ['username', 'userslug']);
	const page = Math.max(1, parseInt(req.query.page, 10) || 1);
	const itemsPerPage = 25;
	const start = (page - 1) * itemsPerPage;
	const stop = start + itemsPerPage - 1;
	const [itemCount, uploadNames] = await Promise.all([
		db.sortedSetCard(`uid:${res.locals.uid}:uploads`),
		db.getSortedSetRevRange(`uid:${res.locals.uid}:uploads`, start, stop),
	]);

	const payload = {};
	payload.uploads = uploadNames.map(uploadName => ({
		name: uploadName,
		url: path.resolve(nconf.get('upload_url'), uploadName),
	}));
	const pageCount = Math.ceil(itemCount / itemsPerPage);
	payload.pagination = pagination.create(page, pageCount, req.query);
	payload.privateUploads = meta.config.privateUploads === 1;
	payload.title = `[[pages:account/uploads, ${username}]]`;
	payload.breadcrumbs = helpers.buildBreadcrumbs([{ text: username, url: `/user/${userslug}` }, { text: '[[global:uploads]]' }]);

	res.render('account/uploads', payload);
};
