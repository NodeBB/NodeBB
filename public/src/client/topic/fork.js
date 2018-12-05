'use strict';


define('forum/topic/fork', ['components', 'postSelect'], function (components, postSelect) {
	var Fork = {};
	var forkModal;
	var forkCommit;
	var fromTid;

	Fork.init = function () {
		fromTid = ajaxify.data.tid;

		$(window).off('action:ajaxify.end', onAjaxifyEnd).on('action:ajaxify.end', onAjaxifyEnd);

		if (forkModal) {
			return;
		}

		app.parseAndTranslate('partials/fork_thread_modal', {}, function (html) {
			forkModal = html;

			forkCommit = forkModal.find('#fork_thread_commit');

			$('body').append(forkModal);

			forkModal.find('.close,#fork_thread_cancel').on('click', closeForkModal);
			forkModal.find('#fork-title').on('keyup', checkForkButtonEnable);

			postSelect.init(function () {
				checkForkButtonEnable();
				showPostsSelected();
			});
			showPostsSelected();

			forkCommit.on('click', createTopicFromPosts);
		});
	};

	function onAjaxifyEnd() {
		if (ajaxify.data.template.name !== 'topic' || ajaxify.data.tid !== fromTid) {
			closeForkModal();
			$(window).off('action:ajaxify.end', onAjaxifyEnd);
		}
	}

	function createTopicFromPosts() {
		forkCommit.attr('disabled', true);
		socket.emit('topics.createTopicFromPosts', {
			title: forkModal.find('#fork-title').val(),
			pids: postSelect.pids,
			fromTid: fromTid,
		}, function (err, newTopic) {
			function fadeOutAndRemove(pid) {
				components.get('post', 'pid', pid).fadeOut(500, function () {
					$(this).remove();
				});
			}
			forkCommit.removeAttr('disabled');
			if (err) {
				return app.alertError(err.message);
			}

			app.alert({
				timeout: 5000,
				title: '[[global:alert.success]]',
				message: '[[topic:fork_success]]',
				type: 'success',
				clickfn: function () {
					ajaxify.go('topic/' + newTopic.slug);
				},
			});

			postSelect.pids.forEach(function (pid) {
				fadeOutAndRemove(pid);
			});

			closeForkModal();
		});
	}

	function showPostsSelected() {
		if (postSelect.pids.length) {
			forkModal.find('#fork-pids').translateHtml('[[topic:fork_pid_count, ' + postSelect.pids.length + ']]');
		} else {
			forkModal.find('#fork-pids').translateHtml('[[topic:fork_no_pids]]');
		}
	}

	function checkForkButtonEnable() {
		if (forkModal.find('#fork-title').val().length && postSelect.pids.length) {
			forkCommit.removeAttr('disabled');
		} else {
			forkCommit.attr('disabled', true);
		}
	}

	function closeForkModal() {
		if (forkModal) {
			forkModal.remove();
			forkModal = null;
			postSelect.disable();
		}
	}

	return Fork;
});
