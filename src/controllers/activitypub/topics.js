'use strict';

const db = require('../../database');
const user = require('../../user');
const topics = require('../../topics');

const pagination = require('../../pagination');
const helpers = require('../helpers');

const controller = module.exports;

controller.list = async function (req, res) {
	const { topicsPerPage } = await user.getSettings(req.uid);
	const page = parseInt(req.query.page, 10) || 1;
	const start = Math.max(0, (page - 1) * topicsPerPage);
	const stop = start + topicsPerPage - 1;

	const tids = await db.getSortedSetRevRange('cid:-1:tids', start, stop);

	const data = {};
	data.topicCount = await db.sortedSetCard('cid:-1:tids');
	data.topics = await topics.getTopicsByTids(tids, { uid: req.uid });
	topics.calculateTopicIndices(data.topics, start);

	const pageCount = Math.max(1, Math.ceil(data.topicCount / topicsPerPage));
	data.pagination = pagination.create(page, pageCount, req.query);
	helpers.addLinkTags({
		url: 'world',
		res: req.res,
		tags: data.pagination.rel,
		page: page,
	});

	res.render('world', data);
};
