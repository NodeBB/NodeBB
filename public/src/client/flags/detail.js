'use strict';

define('forum/flags/detail', ['forum/flags/list', 'components', 'translator', 'benchpress', 'forum/account/header', 'accounts/delete'], function (FlagsList, components, translator, Benchpress, AccountHeader, AccountsDelete) {
	var Detail = {};

	Detail.init = function () {
		// Update attributes
		$('#state').val(ajaxify.data.state).removeAttr('disabled');
		$('#assignee').val(ajaxify.data.assignee).removeAttr('disabled');

		$('#content > div').on('click', '[data-action]', function () {
			var action = this.getAttribute('data-action');
			var uid = $(this).parents('[data-uid]').attr('data-uid');
			var noteEl = document.getElementById('note');

			switch (action) {
				case 'assign':
					$('#assignee').val(app.user.uid);
					// falls through

				case 'update':
					socket.emit('flags.update', {
						flagId: ajaxify.data.flagId,
						data: $('#attributes').serializeArray(),
					}, function (err, history) {
						if (err) {
							return app.alertError(err.message);
						}
						app.alertSuccess('[[flags:updated]]');
						Detail.reloadHistory(history);
					});
					break;

				case 'appendNote':
					socket.emit('flags.appendNote', {
						flagId: ajaxify.data.flagId,
						note: noteEl.value,
						datetime: noteEl.getAttribute('data-datetime'),
					}, function (err, payload) {
						if (err) {
							return app.alertError(err.message);
						}
						app.alertSuccess('[[flags:note-added]]');
						Detail.reloadNotes(payload.notes);
						Detail.reloadHistory(payload.history);

						noteEl.setAttribute('data-action', 'appendNote');
						noteEl.removeAttribute('data-datetime');
					});
					break;

				case 'chat':
					app.newChat(uid);
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
					postAction('delete', ajaxify.data.target.pid, ajaxify.data.target.tid);
					break;

				case 'purge-post':
					postAction('purge', ajaxify.data.target.pid, ajaxify.data.target.tid);
					break;

				case 'restore-post':
					postAction('restore', ajaxify.data.target.pid, ajaxify.data.target.tid);
					break;

				case 'delete-note':
					var datetime = this.closest('[data-datetime]').getAttribute('data-datetime');
					bootbox.confirm('[[flags:delete-note-confirm]]', function (ok) {
						if (ok) {
							socket.emit('flags.deleteNote', {
								flagId: ajaxify.data.flagId,
								datetime: datetime,
							}, function (err, payload) {
								if (err) {
									return app.alertError(err.message);
								}

								app.alertSuccess('[[flags:note-deleted]]');
								Detail.reloadNotes(payload.notes);
								Detail.reloadHistory(payload.history);
							});
						}
					});
					break;

				case 'prepare-edit':
					var selectedNoteEl = this.closest('[data-index]');
					var index = selectedNoteEl.getAttribute('data-index');
					var textareaEl = document.getElementById('note');
					textareaEl.value = ajaxify.data.notes[index].content;
					textareaEl.setAttribute('data-datetime', ajaxify.data.notes[index].datetime);

					var siblings = selectedNoteEl.parentElement.children;
					for (var el in siblings) {
						if (siblings.hasOwnProperty(el)) {
							siblings[el].classList.remove('editing');
						}
					}
					selectedNoteEl.classList.add('editing');
					textareaEl.focus();
					break;
			}
		});

		FlagsList.enableFilterForm();
	};

	function postAction(action, pid, tid) {
		translator.translate('[[topic:post_' + action + '_confirm]]', function (msg) {
			bootbox.confirm(msg, function (confirm) {
				if (!confirm) {
					return;
				}

				socket.emit('posts.' + action, {
					pid: pid,
					tid: tid,
				}, function (err) {
					if (err) {
						app.alertError(err.message);
					}

					ajaxify.refresh();
				});
			});
		});
	}

	Detail.reloadNotes = function (notes) {
		ajaxify.data.notes = notes;
		Benchpress.parse('flags/detail', 'notes', {
			notes: notes,
		}, function (html) {
			var wrapperEl = components.get('flag/notes');
			wrapperEl.empty();
			wrapperEl.html(html);
			wrapperEl.find('span.timeago').timeago();
			document.getElementById('note').value = '';
		});
	};

	Detail.reloadHistory = function (history) {
		Benchpress.parse('flags/detail', 'history', {
			history: history,
		}, function (html) {
			translator.translate(html, function (translated) {
				var wrapperEl = components.get('flag/history');
				wrapperEl.empty();
				wrapperEl.html(translated);
				wrapperEl.find('span.timeago').timeago();
			});
		});
	};

	return Detail;
});
