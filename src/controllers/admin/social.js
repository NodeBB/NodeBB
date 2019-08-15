'use strict';

const social = require('../../social');

const socialController = module.exports;

socialController.get = async function (req, res) {
	const posts = await social.getPostSharing();
	res.render('admin/general/social', {
		posts: posts,
	});
};
