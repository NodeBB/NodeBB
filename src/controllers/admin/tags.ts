'use strict';

import topics from '../../topics';

const tagsController = {} as any;

tagsController.get = async function (req, res) {
	const tags = await topics.getTags(0, 199);
	res.render('admin/manage/tags', { tags: tags });
};

export default tagsController;
