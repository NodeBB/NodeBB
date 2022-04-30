'use strict';

define('forum/flags/detail', [
	'components', 'translator', 'benchpress', 'forum/account/header', 'accounts/delete', 'api', 'bootbox', 'alerts',
], function (components, translator, Benchpress, AccountHeader, AccountsDelete, api, bootbox, alerts) {
	const Detail = {};

	Detail.init = function () {
		// Update attributes
		$('#state').val(ajaxify.data.state).removeAttr('disabled');
		$('#assignee').val(ajaxify.data.assignee).removeAttr('disabled');

		$('#content > div').on('click', '[data-action]', function () {
			const action = this.getAttribute('data-action');
			const uid = $(this).parents('[data-uid]').attr('data-uid');
			const noteEl = document.getElementById('note');

			switch (action) {
				case 'assign':
					$('#assignee').val(app.user.uid);
					// falls through

				case 'update': {
					const data = $('#attributes').serializeArray().reduce((memo, cur) => {
						memo[cur.name] = cur.value;
						return memo;
					}, {});

					api.put(`/flags/${ajaxify.data.flagId}`, data).then((history) => {
						alerts.success('[[flags:updated]]');
						Detail.reloadHistory(history);
					}).catch(alerts.error);
					break;
				}

				case 'appendNote':
					api.post(`/flags/${ajaxify.data.flagId}/notes`, {
						note: noteEl.value,
						datetime: parseInt(noteEl.getAttribute('data-datetime'), 10),
					}).then((payload) => {
						alerts.success('[[flags:note-added]]');
						Detail.reloadNotes(payload.notes);
						Detail.reloadHistory(payload.history);

						noteEl.removeAttribute('data-datetime');
					}).catch(alerts.error);
					break;

				case 'delete-note': {
					const datetime = parseInt(this.closest('[data-datetime]').getAttribute('data-datetime'), 10);
					bootbox.confirm('[[flags:delete-note-confirm]]', function (ok) {
						if (ok) {
							api.delete(`/flags/${ajaxify.data.flagId}/notes/${datetime}`, {}).then((payload) => {
								alerts.success('[[flags:note-deleted]]');
								Detail.reloadNotes(payload.notes);
								Detail.reloadHistory(payload.history);
							}).catch(alerts.error);
						}
					});
					break;
				}
				case 'chat':
					require(['chat'], function (chat) {
						chat.newChat(uid);
					});
					break;

				case 'ban':
					AccountHeader.banAccount(uid, ajaxify.refresh);
					break;

				case 'delete-account':
					AccountsDelete.account(uid, ajaxify.refresh);
					break;

				case 'delete-content':
					AccountsDelete.content(uid, ajaxify.refresh);
					break;

				case 'delete-all':
					AccountsDelete.purge(uid, ajaxify.refresh);
					break;

				case 'delete-post':
					postAction('delete', api.del, `/posts/${ajaxify.data.target.pid}/state`);
					break;

				case 'purge-post':
					postAction('purge', api.del, `/posts/${ajaxify.data.target.pid}`);
					break;

				case 'restore-post':
					postAction('restore', api.put, `/posts/${ajaxify.data.target.pid}/state`);
					break;

				case 'prepare-edit': {
					const selectedNoteEl = this.closest('[data-index]');
					const index = selectedNoteEl.getAttribute('data-index');
					const textareaEl = document.getElementById('note');
					textareaEl.value = ajaxify.data.notes[index].content;
					textareaEl.setAttribute('data-datetime', ajaxify.data.notes[index].datetime);

					const siblings = selectedNoteEl.parentElement.children;
					for (const el in siblings) {
						if (siblings.hasOwnProperty(el)) {
							siblings[el].classList.remove('editing');
						}
					}
					selectedNoteEl.classList.add('editing');
					textareaEl.focus();
					break;
				}

				case 'delete-flag': {
					bootbox.confirm('[[flags:delete-flag-confirm]]', function (ok) {
						if (ok) {
							api.delete(`/flags/${ajaxify.data.flagId}`, {}).then(() => {
								alerts.success('[[flags:flag-deleted]]');
								ajaxify.go('flags');
							}).catch(alerts.error);
						}
					});
					break;
				}
			}
		});
	};

	function postAction(action, method, path) {
		translator.translate('[[topic:post_' + action + '_confirm]]', function (msg) {
			bootbox.confirm(msg, function (confirm) {
				if (!confirm) {
					return;
				}

				method(path).then(ajaxify.refresh).catch(alerts.error);
			});
		});
	}

	Detail.reloadNotes = function (notes) {
		ajaxify.data.notes = notes;
		Benchpress.render('flags/detail', {
			notes: notes,
		}, 'notes').then(function (html) {
			const wrapperEl = components.get('flag/notes');
			wrapperEl.empty();
			wrapperEl.html(html);
			wrapperEl.find('span.timeago').timeago();
			document.getElementById('note').value = '';
		});
	};

	Detail.reloadHistory = function (history) {
		app.parseAndTranslate('flags/detail', 'history', {
			history: history,
		}, function (html) {
			const wrapperEl = components.get('flag/history');
			wrapperEl.empty();
			wrapperEl.html(html);
			wrapperEl.find('span.timeago').timeago();
		});
	};

	return Detail;
});
