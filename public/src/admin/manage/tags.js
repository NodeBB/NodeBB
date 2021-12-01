'use strict';


define('admin/manage/tags', [
	'bootbox',
	'forum/infinitescroll',
	'admin/modules/selectable',
], function (bootbox, infinitescroll, selectable) {
	const Tags = {};

	Tags.init = function () {
		selectable.enable('.tag-management', '.tag-row');

		handleCreate();
		handleSearch();
		handleRename();
		handleDeleteSelected();
	};

	function handleCreate() {
		const createModal = $('#create-modal');
		const createTagName = $('#create-tag-name');
		const createModalGo = $('#create-modal-go');

		createModal.on('keypress', function (e) {
			if (e.keyCode === 13) {
				createModalGo.click();
			}
		});

		$('#create').on('click', function () {
			createModal.modal('show');
			setTimeout(function () {
				createTagName.focus();
			}, 250);
		});

		createModalGo.on('click', function () {
			socket.emit('admin.tags.create', {
				tag: createTagName.val(),
			}, function (err) {
				if (err) {
					return app.alertError(err.message);
				}

				createTagName.val('');
				createModal.on('hidden.bs.modal', function () {
					ajaxify.refresh();
				});
				createModal.modal('hide');
			});
		});
	}

	function handleSearch() {
		$('#tag-search').on('input propertychange', utils.debounce(function () {
			socket.emit('topics.searchAndLoadTags', {
				query: $('#tag-search').val(),
			}, function (err, result) {
				if (err) {
					return app.alertError(err.message);
				}

				app.parseAndTranslate('admin/manage/tags', 'tags', {
					tags: result.tags,
				}, function (html) {
					$('.tag-list').html(html);
					utils.makeNumbersHumanReadable(html.find('.human-readable-number'));
					selectable.enable('.tag-management', '.tag-row');
				});
			});
		}, 250));
	}

	function handleRename() {
		$('#rename').on('click', function () {
			const tagsToModify = $('.tag-row.ui-selected');
			if (!tagsToModify.length) {
				return;
			}

			const modal = bootbox.dialog({
				title: '[[admin/manage/tags:alerts.editing]]',
				message: $('.rename-modal').html(),
				buttons: {
					success: {
						label: 'Save',
						className: 'btn-primary save',
						callback: function () {
							const data = [];
							tagsToModify.each(function (idx, tag) {
								tag = $(tag);
								data.push({
									value: tag.attr('data-tag'),
									newName: modal.find('[data-name="value"]').val(),
								});
							});

							socket.emit('admin.tags.rename', data, function (err) {
								if (err) {
									return app.alertError(err.message);
								}
								app.alertSuccess('[[admin/manage/tags:alerts.update-success]]');
								ajaxify.refresh();
							});
						},
					},
				},
			});
		});
	}

	function handleDeleteSelected() {
		$('#deleteSelected').on('click', function () {
			const tagsToDelete = $('.tag-row.ui-selected');
			if (!tagsToDelete.length) {
				return;
			}

			bootbox.confirm('[[admin/manage/tags:alerts.confirm-delete]]', function (confirm) {
				if (!confirm) {
					return;
				}
				const tags = [];
				tagsToDelete.each(function (index, el) {
					tags.push($(el).attr('data-tag'));
				});
				socket.emit('admin.tags.deleteTags', {
					tags: tags,
				}, function (err) {
					if (err) {
						return app.alertError(err.message);
					}
					tagsToDelete.remove();
				});
			});
		});
	}

	return Tags;
});
