'use strict';


define('forum/topic/manage-editors', [
	'autocomplete',
	'alerts',
], function (autocomplete, alerts) {
	const ManageEditors = {};

	let modal;

	ManageEditors.init = async function (postEl) {
		if (modal) {
			return;
		}
		const pid = postEl.attr('data-pid');

		const { users, groups } = await socket.emit('posts.getEditors', { pid: pid });
		let editors = users;
		let editorGroups = groups;
		app.parseAndTranslate('modals/manage-editors', {
			editors: editors,
			editorGroups: editorGroups,
		}, function (html) {
			modal = html;

			const commitEl = modal.find('#manage_editors_commit');

			$('body').append(modal);

			modal.find('#manage_editors_cancel').on('click', closeModal);

			commitEl.on('click', function () {
				saveEditors(pid);
			});

			autocomplete.user(modal.find('#username'), { filters: ['notbanned'] }, function (ev, ui) {
				const isInEditors = editors.find(e => String(e.uid) === String(ui.item.user.uid));
				if (!isInEditors) {
					editors.push(ui.item.user);
					app.parseAndTranslate('modals/manage-editors', 'editors', {
						editors: editors,
					}, function (html) {
						modal.find('[component="topic/editors"]').html(html);
						modal.find('#username').val('');
					});
				}
			});

			autocomplete.group(modal.find('#editor-group-search'), function (ev, ui) {
				if (!editorGroups.includes(ui.item.group.name)) {
					editorGroups.push(ui.item.group.name);
					app.parseAndTranslate('modals/manage-editors', 'editorGroups', {
						editorGroups: editorGroups,
					}, function (html) {
						modal.find('[component="topic/editor-groups"]').html(html);
						modal.find('#editor-group-search').val('');
					});
				}
			});

			modal.on('click', 'button.remove-user-icon', function () {
				const el = $(this).parents('[data-uid]');
				const uid = el.attr('data-uid');
				editors = editors.filter(e => String(e.uid) !== String(uid));
				el.remove();
			});

			modal.on('click', 'button.remove-group-icon', function () {
				const el = $(this).parents('[data-name]');
				const name = el.attr('data-name');
				editorGroups = editorGroups.filter(g => g !== name);
				el.remove();
			});
		});
	};

	function saveEditors(pid) {
		const uids = modal.find('[component="topic/editors"]>[data-uid]')
			.map((i, el) => $(el).attr('data-uid')).get();
		const groups = modal.find('[component="topic/editor-groups"]>[data-name]')
			.map((i, el) => $(el).attr('data-name')).get();

		socket.emit('posts.saveEditors', { pid: pid, uids: uids, groups: groups }, function (err) {
			if (err) {
				return alerts.error(err);
			}

			closeModal();
		});
	}

	function closeModal() {
		if (modal) {
			modal.remove();
			modal = null;
		}
	}

	return ManageEditors;
});
