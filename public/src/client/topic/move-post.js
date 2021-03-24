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
			moveModal.find('#topicId').on('keyup', utils.debounce(checkMoveButtonEnable, 200));
			postSelect.init(onPostToggled);
			showPostsSelected();

			if (postEl) {
				postSelect.togglePostSelection(postEl, postEl.attr('data-pid'));
			}

			$(window).off('action:ajaxify.end', onAjaxifyEnd)
				.on('action:ajaxify.end', onAjaxifyEnd);

			moveCommit.on('click', function () {
				const targetTid = getTargetTid();
				if (!targetTid) {
					return;
				}
				moveCommit.attr('disabled', true);
				var data = {
					pids: postSelect.pids.slice(),
					tid: targetTid,
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

	function onAjaxifyEnd() {
		if (!moveModal) {
			return;
		}
		var tidInput = moveModal.find('#topicId');
		var targetTid = null;
		if (ajaxify.data.template.topic && ajaxify.data.tid &&
			parseInt(ajaxify.data.tid, 10) !== fromTid
		) {
			targetTid = ajaxify.data.tid;
		}
		if (targetTid && !tidInput.val()) {
			tidInput.val(targetTid);
		}
		checkMoveButtonEnable();
	}

	function getTargetTid() {
		var tidInput = moveModal.find('#topicId');
		if (tidInput.length && tidInput.val()) {
			return tidInput.val();
		}
		return ajaxify.data.template.topic && ajaxify.data.tid;
	}

	function showPostsSelected() {
		if (!moveModal) {
			return;
		}
		var targetTid = getTargetTid();
		if (postSelect.pids.length) {
			if (targetTid && parseInt(targetTid, 10) !== parseInt(fromTid, 10)) {
				api.get('/topics/' + targetTid, {}).then(function (data) {
					if (!data || !data.tid) {
						return app.alertError('[[error:no-topic]]');
					}
					if (data.scheduled) {
						return app.alertError('[[error:cant-move-posts-to-scheduled]]');
					}
					var translateStr = translator.compile('topic:x-posts-will-be-moved-to-y', postSelect.pids.length, data.title);
					moveModal.find('#pids').translateHtml(translateStr);
				});
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
		var targetTid = getTargetTid();
		if (postSelect.pids.length && targetTid &&
			parseInt(targetTid, 10) !== parseInt(fromTid, 10)
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
		if (!data.tid) {
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
			$(window).off('action:ajaxify.end', onAjaxifyEnd);
		}
	}

	return MovePost;
});
