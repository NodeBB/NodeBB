'use strict';

const db = require('../../database');
const user = require('../../user');
const topics = require('../../topics');

const pagination = require('../../pagination');
const helpers = require('../helpers');

const controller = module.exports;

controller.list = async function (req, res, next) {
	const { topicsPerPage } = await user.getSettings(req.uid);
	const page = parseInt(req.query.page, 10) || 1;
	const start = Math.max(0, (page - 1) * topicsPerPage);
	const stop = start + topicsPerPage - 1;

	const sets = ['cid:-1:tids', `uid:${req.uid}:inbox`];
	if (req.params.filter === 'all' || !req.uid) {
		sets.pop();
	} else if (req.params.filter) {
		return helpers.redirect(res, '/world', false);
	}

	const tids = await db.getSortedSetRevIntersect({
		sets,
		start,
		stop,
		weights: sets.map((s, index) => (index ? 0 : 1)),
	});

	const data = {};
	data.topicCount = await db.sortedSetIntersectCard(sets);
	data.topics = await topics.getTopicsByTids(tids, { uid: req.uid });
	topics.calculateTopicIndices(data.topics, start);

	data.breadcrumbs = helpers.buildBreadcrumbs([{ text: `[[pages:world]]` }]);

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
