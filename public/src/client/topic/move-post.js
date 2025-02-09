'use strict';


define('forum/topic/move-post', [
	'components', 'postSelect', 'translator', 'alerts', 'api',
], function (components, postSelect, translator, alerts, api) {
	const MovePost = {};

	let moveModal;
	let moveCommit;
	let fromTid;

	MovePost.init = function (postEl) {
		if (moveModal) {
			return;
		}
		fromTid = ajaxify.data.tid;
		app.parseAndTranslate('modals/move-post', {}, function (html) {
			moveModal = html;

			moveCommit = moveModal.find('#move_posts_confirm');

			$('body').append(moveModal);

			moveModal.find('#move_posts_cancel').on('click', closeMoveModal);
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
				const data = {
					pids: postSelect.pids.slice(),
					tid: targetTid,
				};
				if (config.undoTimeout > 0) {
					return alerts.alert({
						alert_id: 'pids_move_' + postSelect.pids.join('-'),
						title: '[[topic:thread-tools.move-posts]]',
						message: '[[topic:topic-move-posts-success]]',
						type: 'success',
						timeout: config.undoTimeout,
						timeoutfn: function () {
							movePosts(data);
						},
						clickfn: function (alert, params) {
							delete params.timeoutfn;
							alerts.success('[[topic:topic-move-posts-undone]]');
							moveCommit.removeAttr('disabled');
						},
					});
				}

				movePosts(data);
			});
		});
	};

	function onAjaxifyEnd() {
		if (!moveModal) {
			return;
		}
		const tidInput = moveModal.find('#topicId');
		let targetTid = null;
		if (ajaxify.data.template.topic && ajaxify.data.tid &&
			String(ajaxify.data.tid) !== String(fromTid)
		) {
			targetTid = ajaxify.data.tid;
		}
		if (targetTid) {
			tidInput.val(targetTid);
		}
		checkMoveButtonEnable();
	}

	function getTargetTid() {
		const tidInput = moveModal.find('#topicId');
		if (tidInput.length && tidInput.val()) {
			return tidInput.val();
		}
		return ajaxify.data.template.topic && ajaxify.data.tid;
	}

	function showPostsSelected() {
		if (!moveModal) {
			return;
		}
		const targetTid = getTargetTid();
		if (postSelect.pids.length) {
			if (targetTid && String(targetTid) !== String(fromTid)) {
				api.get(`/topics/${targetTid}`, {}).then(function (data) {
					if (!data || !data.tid) {
						return alerts.error('[[error:no-topic]]');
					}
					if (data.scheduled) {
						return alerts.error('[[error:cant-move-posts-to-scheduled]]');
					}
					const translateStr = translator.compile('topic:x-posts-will-be-moved-to-y', postSelect.pids.length, data.title);
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
		const targetTid = getTargetTid();
		if (postSelect.pids.length && targetTid &&
			String(targetTid) !== String(fromTid)
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

		Promise.all(data.pids.map(pid => api.put(`/posts/${encodeURIComponent(pid)}/move`, {
			tid: data.tid,
		}))).then(() => {
			data.pids.forEach(function (pid) {
				components.get('post', 'pid', pid).fadeOut(500, function () {
					$(this).remove();
				});
			});
			if (data.pids.length && ajaxify.data.template.topic &&
				String(data.tid) === String(ajaxify.data.tid)) {
				ajaxify.go(`/post/${data.pids[0]}`);
			}
			closeMoveModal();
		}).catch(alerts.error);
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
