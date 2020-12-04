'use strict';

define('topicThumbs', ['api'], function (api) {
	const Thumbs = {};

	Thumbs.get = id => api.get(`/topics/${id}/thumbs`, {});

	Thumbs.getByPid = pid => fetch(`${config.relative_path}/api/post/pid/${pid}`).then(res => res.json()).then(res => Thumbs.get(res.tid));

	Thumbs.delete = (id, path) => api.del(`/topics/${id}/thumbs`, {
		path: path,
	});

	Thumbs.deleteAll = (id) => {
		Thumbs.get(id).then((thumbs) => {
			Promise.all(thumbs.map(thumb => Thumbs.delete(id, thumb.url)));
		});
	};

	return Thumbs;
});
