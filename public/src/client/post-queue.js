'use strict';


define('forum/post-queue', [
	'categoryFilter', 'categorySelector', 'api', 'alerts', 'translator',
	'bootbox', 'accounts/moderate', 'accounts/delete',
], function (
	categoryFilter, categorySelector, api, alerts, translator,
	bootbox, AccountModerate, AccountsDelete
) {
	const PostQueue = {};

	PostQueue.init = function () {
		$('#content [data-bs-toggle="tooltip"]').tooltip();

		categoryFilter.init($('[component="category/dropdown"]'), {
			privilege: 'moderate',
		});

		handleActions();
		handleBulkActions();
		handleContentEdit('[data-action="editContent"]', '.post-content-editable', 'textarea', '.post-content');
		handleContentEdit('[data-action="editTitle"]', '.topic-title-editable', 'input', '.topic-title');

		$('.posts-list').on('click', '.topic-category[data-editable]', function (e) {
			handleCategoryChange(this);
			e.stopPropagation();
			e.preventDefault();
		});

		$('[component="post/content"] img:not(.not-responsive)').addClass('img-fluid');
		showLinksInPosts();
	};

	function showLinksInPosts() {
		$('.posts-list [data-id]').each((idx, el) => {
			const $el = $(el);
			const linkContainer = $el.find('[component="post-queue/link-container"]');
			const linkList = linkContainer.find('[component="post-queue/link-container/list"]');
			const linksInPost = $el.find('.post-content a');
			linksInPost.each((idx, link) => {
				const href = $(link).attr('href');
				linkList.append(`<li><a href="${href}">${href}</a></li>`);
			});
			linkContainer.toggleClass('hidden', !linksInPost.length);
		});
	}

	function confirmReject(msg) {
		return new Promise((resolve) => {
			bootbox.confirm(msg, resolve);
		});
	}

	function handleContentEdit(triggerClass, editableClass, inputSelector, displayClass) {
		$('.posts-list').on('click', triggerClass, function () {
			const el = $(this);
			const inputEl = el.parents('[data-id]').find(editableClass);
			const displayEl = el.parents('[data-id]').find(displayClass);
			if (inputEl.length) {
				displayEl.addClass('hidden');
				inputEl.removeClass('hidden').find(inputSelector).focus();
			}
		});

		$('.posts-list').on('blur', editableClass + ' ' + inputSelector, function () {
			const textarea = $(this);
			const preview = textarea.parent().parent().find(displayClass);
			const id = textarea.parents('[data-id]').attr('data-id');
			const titleEdit = triggerClass === '[data-action="editTitle"]';

			api.put(`/posts/queue/${id}`, {
				title: titleEdit ? textarea.val() : undefined,
				content: titleEdit ? undefined : textarea.val(),
			}).then((data) => {
				if (titleEdit) {
					preview.find('.title-text').text(data.postData.title);
				} else {
					preview.html(data.postData.content);
				}

				textarea.parent().addClass('hidden');
				preview.removeClass('hidden');
			}).catch(alerts.error);
		});
	}

	function handleCategoryChange(categoryEl) {
		const $this = $(categoryEl);
		const id = $this.parents('[data-id]').attr('data-id');
		categorySelector.modal({
			onSubmit: function (selectedCategory) {
				Promise.all([
					api.get(`/categories/${selectedCategory.cid}`, {}),
					api.put(`/posts/queue/${id}`, {
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
	}

	function handleActions() {
		const listEl = document.querySelector('.posts-list');
		if (listEl) {
			listEl.addEventListener('click', (e) => {
				const subselector = e.target.closest('[data-action]');
				if (subselector) {
					const action = subselector.getAttribute('data-action');
					const uid = subselector.closest('[data-uid]').getAttribute('data-uid');
					switch (action) {
						case 'editCategory': {
							const categoryEl = e.target.closest('[data-id]').querySelector('.topic-category');
							handleCategoryChange(categoryEl);
							break;
						}

						case 'ban':
							AccountModerate.banAccount(uid, ajaxify.refresh);
							break;

						case 'unban':
							AccountModerate.unbanAccount(uid);
							break;

						case 'mute':
							AccountModerate.muteAccount(uid, ajaxify.refresh);
							break;

						case 'unmute':
							AccountModerate.unmuteAccount(uid);
							break;

						case 'delete-account':
							AccountsDelete.account(uid, ajaxify.go.bind(null, 'post-queue'));
							break;

						case 'delete-content':
							AccountsDelete.content(uid, ajaxify.go.bind(null, 'post-queue'));
							break;

						case 'delete-all':
							AccountsDelete.purge(uid, ajaxify.go.bind(null, 'post-queue'));
							break;

						case 'accept':
							handleAccept(subselector);
							break;

						case 'reject':
							handleReject(subselector);
							break;

						case 'notify':
							handleNotify(subselector);
							break;

						default:
							throw new Error(`Unknown action: ${action}`);
					}
				}
			});
		}
	}

	function handleAccept(btn) {
		const parent = $(btn).parents('[data-id]');
		const id = parent.attr('data-id');
		doAction('accept', id).then(() => removePostQueueElement(parent)).catch(alerts.error);
	}

	async function handleReject(btn) {
		const parent = $(btn).parents('[data-id]');
		const id = parent.attr('data-id');
		const translationString = ajaxify.data.canAccept ?
			'[[post-queue:confirm-reject]]' :
			'[[post-queue:confirm-remove]]';

		const message = await getMessage(translationString);
		if (message === false) {
			return;
		}
		doAction('reject', id, message).then(() => removePostQueueElement(parent)).catch(alerts.error);
	}

	function removePostQueueElement(parent) {
		const listContainer = parent.get(0).parentNode;
		parent.remove();
		if (listContainer.childElementCount === 0) {
			if (ajaxify.data.singlePost) {
				ajaxify.go('/post-queue' + window.location.search);
			} else {
				ajaxify.refresh();
			}
		}
	}

	async function handleNotify(btn) {
		const parent = $(btn).parents('[data-id]');
		const id = parent.attr('data-id');
		const message = await getMessage('[[post-queue:notify-user]]');
		if (message === false) {
			return;
		}

		doAction('notify', id, message).catch(alerts.error);
	}

	async function getMessage(title) {
		const reasons = await socket.emit('user.getCustomReasons', { type: 'post-queue' });
		const html = await app.parseAndTranslate('partials/custom-reason', { reasons });

		return new Promise((resolve) => {
			let resolved = false;
			const done = (value) => {
				if (resolved) {
					return;
				}
				resolved = true;
				resolve(value);
			};

			const modal = bootbox.dialog({
				title: title,
				message: `<form class="form">${html.html()}</form>`,
				show: true,
				onEscape: true,
				buttons: {
					close: {
						label: '[[global:close]]',
						className: 'btn-link',
						callback: function () {
							done(false);
						},
					},
					submit: {
						label: '[[modules:bootbox.confirm]]',
						callback: function () {
							done(modal.find('[name="reason"]').val());
						},
					},
				},
			});

			modal.on('hidden.bs.modal', () => {
				done(false);
			});
			modal.find('[data-key]').on('click', function () {
				const reason = reasons.find(r => String(r.key) === $(this).attr('data-key'));
				if (reason && reason.body) {
					modal.find('[name="reason"]').val(translator.unescape(reason.body));
				}
			});
		});
	}

	async function doAction(action, id, message = '') {
		const actionsMap = {
			accept: () => api.post(`/posts/queue/${id}`, {}),
			reject: () => api.del(`/posts/queue/${id}`, { message }),
			notify: () => api.post(`/posts/queue/${id}/notify`, { message }),
		};
		if (actionsMap[action]) {
			const result = actionsMap[action]();
			return (result instanceof Promise ? result : Promise.resolve(result));
		}
		throw new Error(`Unknown action: ${action}`);
	}

	function handleBulkActions() {
		$('[component="post-queue/bulk-actions"]').on('click', '[data-action]', async function () {
			const bulkAction = $(this).attr('data-action');
			let queueEls = $('.posts-list [data-id]');
			if (bulkAction === 'accept-selected' || bulkAction === 'reject-selected') {
				queueEls = queueEls.filter(
					(i, el) => $(el).find('input[type="checkbox"]').is(':checked')
				);
			}
			const ids = queueEls.map((i, el) => $(el).attr('data-id')).get();
			const showConfirm = bulkAction === 'reject-all' || bulkAction === 'reject-selected';
			const translationString = ajaxify.data.canAccept ?
				`${bulkAction}-confirm` :
				`${bulkAction.replace(/^reject/, 'remove')}-confirm`;
			if (!ids.length || (showConfirm && !(await confirmReject(`[[post-queue:${translationString}, ${ids.length}]]`)))) {
				return;
			}
			const action = bulkAction.split('-')[0];
			const promises = ids.map(id => doAction(action, id));

			Promise.allSettled(promises).then(function (results) {
				const fulfilled = results.filter(res => res.status === 'fulfilled').length;
				const errors = results.filter(res => res.status === 'rejected');
				if (fulfilled) {
					alerts.success(`[[post-queue:bulk-${action}-success, ${fulfilled}]]`);
					ajaxify.refresh();
				}

				errors.forEach(res => alerts.error(res.reason));
			});
		});
	}

	return PostQueue;
});
