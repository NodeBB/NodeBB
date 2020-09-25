'use strict';


define('forum/topic/change-owner', [
	'components',
	'postSelect',
	'autocomplete',
], function (components, postSelect, autocomplete) {
	var ChangeOwner = {};

	var modal;
	var commit;
	var toUid = 0;
	ChangeOwner.init = function (postEl) {
		if (modal) {
			return;
		}
		app.parseAndTranslate('partials/change_owner_modal', {}, function (html) {
			modal = html;

			commit = modal.find('#change_owner_commit');

			$('body').append(modal);

			modal.find('.close,#change_owner_cancel').on('click', closeModal);
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

			autocomplete.user(modal.find('#username'), { notBanned: true }, function (ev, ui) {
				toUid = ui.item.user.uid;
				checkButtonEnable();
			});
		});
	};

	function showPostsSelected() {
		if (postSelect.pids.length) {
			modal.find('#pids').translateHtml('[[topic:fork_pid_count, ' + postSelect.pids.length + ']]');
		} else {
			modal.find('#pids').translateHtml('[[topic:fork_no_pids]]');
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
		socket.emit('posts.changeOwner', { pids: postSelect.pids, toUid: toUid }, function (err) {
			if (err) {
				return app.alertError(err.message);
			}
			ajaxify.refresh();

			closeModal();
		});
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
