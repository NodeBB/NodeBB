'use strict';

define('topicThumbs', [
	'api', 'bootbox', 'alerts', 'uploader', 'benchpress', 'translator', 'jquery-ui/widgets/sortable',
], function (api, bootbox, alerts, uploader, Benchpress, translator) {
	const Thumbs = {};

	Thumbs.get = id => api.get(`/topics/${id}/thumbs`, { thumbsOnly: 1 });

	Thumbs.delete = (id, path) => api.del(`/topics/${id}/thumbs`, {
		path: path,
	});

	Thumbs.updateTopicThumbs = async (tid) => {
		const thumbs = await Thumbs.get(tid);
		const html = await app.parseAndTranslate('partials/topic/thumbs', { thumbs });
		$('[component="topic/thumb/list"]').html(html);
	};

	Thumbs.deleteAll = (id) => {
		Thumbs.get(id).then((thumbs) => {
			Promise.all(thumbs.map(thumb => Thumbs.delete(id, thumb.url)));
		});
	};

	Thumbs.upload = () => new Promise((resolve) => {
		uploader.show({
			title: '[[topic:composer.thumb-title]]',
			method: 'put',
			route: config.relative_path + `/api/topic/thumb/upload`,
		}, function (url) {
			resolve(url);
		});
	});

	Thumbs.modal = {};

	Thumbs.modal.open = function (payload) {
		const { id, postData } = payload;
		let { modal } = payload;
		const thumbs = postData.thumbs || [];

		return new Promise((resolve) => {
			Benchpress.render('modals/topic-thumbs', { thumbs }).then((html) => {
				if (modal) {
					translator.translate(html, function (translated) {
						modal.find('.bootbox-body').html(translated);
						Thumbs.modal.handleSort({ modal, thumbs });
					});
				} else {
					modal = bootbox.dialog({
						title: '[[modules:thumbs.modal.title]]',
						message: html,
						onEscape: true,
						backdrop: true,
						buttons: {
							add: {
								label: '<i class="fa fa-plus"></i> [[modules:thumbs.modal.add]]',
								className: 'btn-success',
								callback: () => {
									Thumbs.upload().then((thumbUrl) => {
										postData.thumbs.push(
											thumbUrl.replace(new RegExp(`^${config.upload_url}`), '')
										);

										Thumbs.modal.open({ ...payload, modal });
										require(['composer'], (composer) => {
											composer.updateThumbCount(id, $(`[component="composer"][data-uuid="${id}"]`));
											resolve();
										});
									});
									return false;
								},
							},
							close: {
								label: '[[global:close]]',
								className: 'btn-primary',
							},
						},
					});
					Thumbs.modal.handleDelete({ ...payload, modal });
					Thumbs.modal.handleSort({ modal, thumbs });
				}
			});
		});
	};

	Thumbs.modal.handleDelete = (payload) => {
		const modalEl = payload.modal.get(0);
		const { id: uuid } = payload;
		modalEl.addEventListener('click', (ev) => {
			if (ev.target.closest('button[data-action="remove"]')) {
				bootbox.confirm('[[modules:thumbs.modal.confirm-remove]]', (ok) => {
					if (!ok) {
						return;
					}
					const path = ev.target.closest('[data-path]').getAttribute('data-path');
					const postData = payload.postData;
					if (postData && postData.thumbs && postData.thumbs.includes(path)) {
						postData.thumbs = postData.thumbs.filter(thumb => thumb !== path);
						Thumbs.modal.open(payload);
						require(['composer'], (composer) => {
							composer.updateThumbCount(uuid, $(`[component="composer"][data-uuid="${uuid}"]`));
						});
					}
				});
			}
		});
	};

	Thumbs.modal.handleSort = ({ modal, thumbs }) => {
		if (thumbs.length > 1) {
			const selectorEl = modal.find('.topic-thumbs-modal');
			selectorEl.sortable({
				items: '[data-path]',
			});
			selectorEl.on('sortupdate', function () {
				if (!thumbs) return;
				const newOrder = [];
				selectorEl.find('[data-path]').each(function () {
					const path = $(this).attr('data-path');
					const thumb = thumbs.find(t => t === path);
					if (thumb) {
						newOrder.push(thumb);
					}
				});
				// Mutate thumbs array in place
				thumbs.length = 0;
				Array.prototype.push.apply(thumbs, newOrder);
			});
		}
	};

	return Thumbs;
});
