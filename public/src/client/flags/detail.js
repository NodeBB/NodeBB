'use strict';

define('forum/flags/detail', ['forum/flags/list', 'components', 'translator', 'benchpress', 'forum/account/header', 'accounts/delete'], function (FlagsList, components, translator, Benchpress, AccountHeader, AccountsDelete) {
	var Detail = {};

	Detail.init = function () {
		// Update attributes
		$('#state').val(ajaxify.data.state).removeAttr('disabled');
		$('#assignee').val(ajaxify.data.assignee).removeAttr('disabled');

		$('[data-action]').on('click', function () {
			var action = this.getAttribute('data-action');
			var uid = $(this).parents('[data-uid]').attr('data-uid');

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
						note: document.getElementById('note').value,
					}, function (err, payload) {
						if (err) {
							return app.alertError(err.message);
						}
						app.alertSuccess('[[flags:note-added]]');
						Detail.reloadNotes(payload.notes);
						Detail.reloadHistory(payload.history);
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
