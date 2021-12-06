'use strict';


define('forum/post-queue', [
	'categoryFilter', 'categorySelector', 'api', 'alerts',
], function (categoryFilter, categorySelector, api, alerts) {
	const PostQueue = {};

	PostQueue.init = function () {
		$('[data-toggle="tooltip"]').tooltip();

		categoryFilter.init($('[component="category/dropdown"]'), {
			privilege: 'moderate',
		});

		$('.posts-list').on('click', '[data-action]', function () {
			const parent = $(this).parents('[data-id]');
			const action = $(this).attr('data-action');
			const id = parent.attr('data-id');
			const listContainer = parent.get(0).parentNode;

			if (!['accept', 'reject'].some(function (valid) {
				return action === valid;
			})) {
				return;
			}

			socket.emit('posts.' + action, { id: id }, function (err) {
				if (err) {
					return alerts.error(err);
				}
				parent.remove();

				if (listContainer.childElementCount === 0) {
					ajaxify.refresh();
				}
			});
			return false;
		});

		handleContentEdit('.post-content', '.post-content-editable', 'textarea');
		handleContentEdit('.topic-title', '.topic-title-editable', 'input');

		$('.posts-list').on('click', '.topic-category[data-editable]', function () {
			const $this = $(this);
			const id = $this.parents('[data-id]').attr('data-id');
			categorySelector.modal({
				onSubmit: function (selectedCategory) {
					Promise.all([
						api.get(`/categories/${selectedCategory.cid}`, {}),
						socket.emit('posts.editQueuedContent', {
							id: id,
							cid: selectedCategory.cid,
						}),
					]).then(function (result) {
						const category = result[0];
						app.parseAndTranslate('post-queue', 'posts', {
							posts: [{
								category: category,
							}],
						}, function (html) {
							if ($this.find('.category-text').length) {
								$this.find('.category-text').text(html.find('.topic-category .category-text').text());
							} else {
								// for backwards compatibility, remove in 1.16.0
								$this.replaceWith(html.find('.topic-category'));
							}
						});
					}).catch(alerts.error);
				},
			});
			return false;
		});

		$('[component="post/content"] img:not(.not-responsive)').addClass('img-responsive');
	};

	function handleContentEdit(displayClass, editableClass, inputSelector) {
		$('.posts-list').on('click', displayClass, function () {
			const el = $(this);
			const inputEl = el.parent().find(editableClass);
			if (inputEl.length) {
				el.addClass('hidden');
				inputEl.removeClass('hidden').find(inputSelector).focus();
			}
		});

		$('.posts-list').on('blur', editableClass + ' ' + inputSelector, function () {
			const textarea = $(this);
			const preview = textarea.parent().parent().find(displayClass);
			const id = textarea.parents('[data-id]').attr('data-id');
			const titleEdit = displayClass === '.topic-title';

			socket.emit('posts.editQueuedContent', {
				id: id,
				title: titleEdit ? textarea.val() : undefined,
				content: titleEdit ? undefined : textarea.val(),
			}, function (err, data) {
				if (err) {
					return alerts.error(err);
				}
				if (titleEdit) {
					if (preview.find('.title-text').length) {
						preview.find('.title-text').text(data.postData.title);
					} else {
						// for backwards compatibility, remove in 1.16.0
						preview.html(data.postData.title);
					}
				} else {
					preview.html(data.postData.content);
				}

				textarea.parent().addClass('hidden');
				preview.removeClass('hidden');
			});
		});
	}

	return PostQueue;
});
