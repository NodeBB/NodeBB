'use strict';


define('forum/topic/change-owner', [
	'postSelect',
	'autocomplete',
	'alerts',
	'api',
], function (postSelect, autocomplete, alerts, api) {
	const ChangeOwner = {};

	let modal;
	let commit;
	let toUid = 0;
	ChangeOwner.init = function (postEl) {
		if (modal) {
			return;
		}
		app.parseAndTranslate('modals/change-owner', {}, function (html) {
			modal = html;

			commit = modal.find('#change_owner_commit');

			$('body').append(modal);

			modal.find('#change_owner_cancel').on('click', closeModal);
			modal.find('#username').on('keyup', checkButtonEnable);
			postSelect.init(onPostToggled, {
				allowMainPostSelect: true,
			});
			showPostsSelected();

			if (postEl) {
				postSelect.togglePostSelection(postEl, postEl.attr('data-pid'));
			}

			commit.on('click', function () {
				changeOwner();
			});

			autocomplete.user(modal.find('#username'), { filters: ['notbanned'] }, function (ev, ui) {
				toUid = ui.item.user.uid;
				checkButtonEnable();
			});
		});
	};

	function showPostsSelected() {
		if (postSelect.pids.length) {
			modal.find('#pids').translateHtml('[[topic:fork-pid-count, ' + postSelect.pids.length + ']]');
		} else {
			modal.find('#pids').translateHtml('[[topic:fork-no-pids]]');
		}
	}

	function checkButtonEnable() {
		if (toUid && modal.find('#username').length && modal.find('#username').val().length && postSelect.pids.length) {
			commit.removeAttr('disabled');
		} else {
			commit.attr('disabled', true);
		}
	}

	function onPostToggled() {
		checkButtonEnable();
		showPostsSelected();
	}

	function changeOwner() {
		if (!toUid) {
			return;
		}

		api.post('/posts/owner', { pids: postSelect.pids, uid: toUid}).then(() => {
			ajaxify.go(`/post/${postSelect.pids[0]}`);

			closeModal();
		}).catch(alerts.error);
	}

	function closeModal() {
		if (modal) {
			modal.remove();
			modal = null;
			postSelect.disable();
		}
	}

	return ChangeOwner;
});
