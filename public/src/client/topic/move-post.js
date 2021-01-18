'use strict';


define('forum/topic/move-post', [
	'components', 'postSelect', 'translator', 'alerts', 'api',
], function (components, postSelect, translator, alerts, api) {
	var MovePost = {};

	var moveModal;
	var moveCommit;
	var fromTid;

	MovePost.init = function (postEl) {
		if (moveModal) {
			return;
		}
		fromTid = ajaxify.data.tid;
		app.parseAndTranslate('modals/move-post', {}, function (html) {
			moveModal = html;

			moveCommit = moveModal.find('#move_posts_confirm');

			$('body').append(moveModal);

			moveModal.find('.close,#move_posts_cancel').on('click', closeMoveModal);
			postSelect.init(onPostToggled);
			showPostsSelected();

			if (postEl) {
				postSelect.togglePostSelection(postEl, postEl.attr('data-pid'));
			}

			$(window).off('action:ajaxify.end', checkMoveButtonEnable)
				.on('action:ajaxify.end', checkMoveButtonEnable);

			moveCommit.on('click', function () {
				if (!ajaxify.data.template.topic || !ajaxify.data.tid) {
					return;
				}
				moveCommit.attr('disabled', true);
				var data = {
					pids: postSelect.pids.slice(),
					tid: ajaxify.data.tid,
				};
				alerts.alert({
					alert_id: 'pids_move_' + postSelect.pids.join('-'),
					title: '[[topic:thread_tools.move-posts]]',
					message: '[[topic:topic_move_posts_success]]',
					type: 'success',
					timeout: 10000,
					timeoutfn: function () {
						movePosts(data);
					},
					clickfn: function (alert, params) {
						delete params.timeoutfn;
						app.alertSuccess('[[topic:topic_move_posts_undone]]');
						moveCommit.removeAttr('disabled');
					},
				});
			});
		});
	};

	function showPostsSelected() {
		if (!moveModal) {
			return;
		}
		if (postSelect.pids.length) {
			if (ajaxify.data.template.topic && ajaxify.data.tid && ajaxify.data.tid !== fromTid) {
				var translateStr = translator.compile('topic:x-posts-will-be-moved-to-y', postSelect.pids.length, ajaxify.data.title);
				moveModal.find('#pids').translateHtml(translateStr);
			} else {
				moveModal.find('#pids').translateHtml('[[topic:x-posts-selected, ' + postSelect.pids.length + ']]');
			}
		} else {
			moveModal.find('#pids').translateHtml('[[topic:no-posts-selected]]');
		}
	}

	function checkMoveButtonEnable() {
		if (!moveModal) {
			return;
		}

		if (postSelect.pids.length && ajaxify.data.tid &&
			ajaxify.data.template.topic && ajaxify.data.tid !== fromTid
		) {
			moveCommit.removeAttr('disabled');
		} else {
			moveCommit.attr('disabled', true);
		}
		showPostsSelected();
	}

	function onPostToggled() {
		checkMoveButtonEnable();
	}

	function movePosts(data) {
		if (!ajaxify.data.template.topic || !data.tid) {
			return;
		}

		Promise.all(data.pids.map(pid => api.put(`/posts/${pid}/move`, {
			tid: data.tid,
		}))).then(() => {
			data.pids.forEach(function (pid) {
				components.get('post', 'pid', pid).fadeOut(500, function () {
					$(this).remove();
				});
			});

			closeMoveModal();
		}).catch(app.alertError);
	}

	function closeMoveModal() {
		if (moveModal) {
			moveModal.remove();
			moveModal = null;
			postSelect.disable();
		}
	}

	return MovePost;
});
