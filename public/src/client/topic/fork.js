'use strict';


define('forum/topic/fork', [
	'components', 'postSelect', 'alerts', 'categorySelector',
], function (components, postSelect, alerts, categorySelector) {
	const Fork = {};
	let forkModal;
	let forkCommit;
	let fromTid;
	let selectedCategory;

	Fork.init = function () {
		fromTid = ajaxify.data.tid;
		selectedCategory = ajaxify.data.category;

		$(window).off('action:ajaxify.end', onAjaxifyEnd).on('action:ajaxify.end', onAjaxifyEnd);

		if (forkModal) {
			return;
		}

		app.parseAndTranslate('modals/fork-topic', {
			selectedCategory: selectedCategory,
		}, function (html) {
			forkModal = html;

			forkCommit = forkModal.find('#fork_thread_commit');

			$('body').append(forkModal);

			categorySelector.init(forkModal.find('[component="category-selector"]'), {
				onSelect: function (category) {
					selectedCategory = category;
				},
				privilege: 'moderate',
			});

			forkModal.find('#fork_thread_cancel').on('click', closeForkModal);
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
		if (!selectedCategory) {
			return;
		}
		forkCommit.attr('disabled', true);
		socket.emit('topics.createTopicFromPosts', {
			title: forkModal.find('#fork-title').val(),
			pids: postSelect.pids,
			fromTid: fromTid,
			cid: selectedCategory.cid,
		}, function (err, newTopic) {
			function fadeOutAndRemove(pid) {
				components.get('post', 'pid', pid).fadeOut(500, function () {
					$(this).remove();
				});
			}
			forkCommit.removeAttr('disabled');
			if (err) {
				return alerts.error(err.message);
			}

			alerts.alert({
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
