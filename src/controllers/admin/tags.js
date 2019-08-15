'use strict';

const topics = require('../../topics');

const tagsController = module.exports;

tagsController.get = async function (req, res) {
	const tags = await topics.getTags(0, 199);
	res.render('admin/manage/tags', { tags: tags });
};
