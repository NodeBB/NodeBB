'use strict';

import path from 'path';
import nconf from 'nconf';

import db from '../../database';
import helpers from '../helpers';
import meta from '../../meta';
const pagination = require('../../pagination');
const accountHelpers = require('./helpers').defualt;

const uploadsController  = {} as any;

uploadsController.get = async function (req, res, next) {
	const userData = await accountHelpers.getUserDataByUserSlug(req.params.userslug, req.uid, req.query);
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

	userData.uploads = uploadNames.map((uploadName: string) => ({
		name: uploadName,
		url: path.resolve(nconf.get('upload_url'), uploadName),
	}));
	const pageCount = Math.ceil(itemCount / itemsPerPage);
	userData.pagination = pagination.create(page, pageCount, req.query);
	userData.privateUploads = meta.config.privateUploads === 1;
	userData.title = `[[pages:account/uploads, ${userData.username}]]`;
	userData.breadcrumbs = helpers.buildBreadcrumbs([{ text: userData.username, url: `/user/${userData.userslug}` }, { text: '[[global:uploads]]' }]);
	res.render('account/uploads', userData);
};
