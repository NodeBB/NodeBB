
'use strict';


define('forum/category/tools', [
	'forum/topic/move',
	'forum/topic/merge',
	'topicSelect',
	'components',
	'translator',
], function (move, merge, topicSelect, components, translator) {
	var CategoryTools = {};

	CategoryTools.init = function (cid) {
		CategoryTools.cid = cid;

		topicSelect.init(updateDropdownOptions);

		handlePinnedTopicSort();

		components.get('topic/delete').on('click', function () {
			categoryCommand('delete', topicSelect.getSelectedTids());
			return false;
		});

		components.get('topic/restore').on('click', function () {
			categoryCommand('restore', topicSelect.getSelectedTids());
			return false;
		});

		components.get('topic/purge').on('click', function () {
			categoryCommand('purge', topicSelect.getSelectedTids());
			return false;
		});

		components.get('topic/lock').on('click', function () {
			var tids = topicSelect.getSelectedTids();
			if (!tids.length) {
				return app.alertError('[[error:no-topics-selected]]');
			}
			socket.emit('topics.lock', { tids: tids, cid: CategoryTools.cid }, onCommandComplete);
			return false;
		});

		components.get('topic/unlock').on('click', function () {
			var tids = topicSelect.getSelectedTids();
			if (!tids.length) {
				return app.alertError('[[error:no-topics-selected]]');
			}
			socket.emit('topics.unlock', { tids: tids, cid: CategoryTools.cid }, onCommandComplete);
			return false;
		});

		components.get('topic/pin').on('click', function () {
			var tids = topicSelect.getSelectedTids();
			if (!tids.length) {
				return app.alertError('[[error:no-topics-selected]]');
			}
			socket.emit('topics.pin', { tids: tids, cid: CategoryTools.cid }, onCommandComplete);
			return false;
		});

		components.get('topic/unpin').on('click', function () {
			var tids = topicSelect.getSelectedTids();
			if (!tids.length) {
				return app.alertError('[[error:no-topics-selected]]');
			}
			socket.emit('topics.unpin', { tids: tids, cid: CategoryTools.cid }, onCommandComplete);
			return false;
		});

		components.get('topic/mark-unread-for-all').on('click', function () {
			var tids = topicSelect.getSelectedTids();
			if (!tids.length) {
				return app.alertError('[[error:no-topics-selected]]');
			}
			socket.emit('topics.markAsUnreadForAll', tids, function (err) {
				if (err) {
					return app.alertError(err.message);
				}
				app.alertSuccess('[[topic:markAsUnreadForAll.success]]');
				tids.forEach(function (tid) {
					$('[component="category/topic"][data-tid="' + tid + '"]').addClass('unread');
				});
				onCommandComplete();
			});
			return false;
		});

		components.get('topic/move').on('click', function () {
			var tids = topicSelect.getSelectedTids();

			if (!tids.length) {
				return app.alertError('[[error:no-topics-selected]]');
			}
			move.init(tids, cid, onCommandComplete);
			return false;
		});

		components.get('topic/move-all').on('click', function () {
			move.init(null, cid, function (err) {
				if (err) {
					return app.alertError(err.message);
				}

				ajaxify.refresh();
			});
		});

		merge.init();

		CategoryTools.removeListeners();
		socket.on('event:topic_deleted', setDeleteState);
		socket.on('event:topic_restored', setDeleteState);
		socket.on('event:topic_purged', onTopicPurged);
		socket.on('event:topic_locked', setLockedState);
		socket.on('event:topic_unlocked', setLockedState);
		socket.on('event:topic_pinned', setPinnedState);
		socket.on('event:topic_unpinned', setPinnedState);
		socket.on('event:topic_moved', onTopicMoved);
	};

	function categoryCommand(command, tids) {
		if (!tids.length) {
			return app.alertError('[[error:no-topics-selected]]');
		}

		translator.translate('[[topic:thread_tools.' + command + '_confirm]]', function (msg) {
			bootbox.confirm(msg, function (confirm) {
				if (!confirm) {
					return;
				}

				socket.emit('topics.' + command, { tids: tids, cid: CategoryTools.cid }, onDeletePurgeComplete);
			});
		});
	}

	CategoryTools.removeListeners = function () {
		socket.removeListener('event:topic_deleted', setDeleteState);
		socket.removeListener('event:topic_restored', setDeleteState);
		socket.removeListener('event:topic_purged', onTopicPurged);
		socket.removeListener('event:topic_locked', setLockedState);
		socket.removeListener('event:topic_unlocked', setLockedState);
		socket.removeListener('event:topic_pinned', setPinnedState);
		socket.removeListener('event:topic_unpinned', setPinnedState);
		socket.removeListener('event:topic_moved', onTopicMoved);
	};

	function closeDropDown() {
		$('.thread-tools.open').find('.dropdown-toggle').trigger('click');
	}

	function onCommandComplete(err) {
		if (err) {
			return app.alertError(err.message);
		}
		closeDropDown();
		topicSelect.unselectAll();
	}

	function onDeletePurgeComplete(err) {
		if (err) {
			return app.alertError(err.message);
		}
		closeDropDown();
		updateDropdownOptions();
	}

	function updateDropdownOptions() {
		var tids = topicSelect.getSelectedTids();
		var isAnyDeleted = isAny(isTopicDeleted, tids);
		var areAllDeleted = areAll(isTopicDeleted, tids);
		var isAnyPinned = isAny(isTopicPinned, tids);
		var isAnyLocked = isAny(isTopicLocked, tids);

		components.get('topic/delete').toggleClass('hidden', isAnyDeleted);
		components.get('topic/restore').toggleClass('hidden', !isAnyDeleted);
		components.get('topic/purge').toggleClass('hidden', !areAllDeleted);

		components.get('topic/lock').toggleClass('hidden', isAnyLocked);
		components.get('topic/unlock').toggleClass('hidden', !isAnyLocked);

		components.get('topic/pin').toggleClass('hidden', isAnyPinned);
		components.get('topic/unpin').toggleClass('hidden', !isAnyPinned);
	}

	function isAny(method, tids) {
		for (var i = 0; i < tids.length; i += 1) {
			if (method(tids[i])) {
				return true;
			}
		}
		return false;
	}

	function areAll(method, tids) {
		for (var i = 0; i < tids.length; i += 1) {
			if (!method(tids[i])) {
				return false;
			}
		}
		return true;
	}

	function isTopicDeleted(tid) {
		return getTopicEl(tid).hasClass('deleted');
	}

	function isTopicLocked(tid) {
		return getTopicEl(tid).hasClass('locked');
	}

	function isTopicPinned(tid) {
		return getTopicEl(tid).hasClass('pinned');
	}

	function getTopicEl(tid) {
		return components.get('category/topic', 'tid', tid);
	}

	function setDeleteState(data) {
		var topic = getTopicEl(data.tid);
		topic.toggleClass('deleted', data.isDeleted);
		topic.find('[component="topic/locked"]').toggleClass('hide', !data.isDeleted);
	}

	function setPinnedState(data) {
		var topic = getTopicEl(data.tid);
		topic.toggleClass('pinned', data.isPinned);
		topic.find('[component="topic/pinned"]').toggleClass('hide', !data.isPinned);
		ajaxify.refresh();
	}

	function setLockedState(data) {
		var topic = getTopicEl(data.tid);
		topic.toggleClass('locked', data.isLocked);
		topic.find('[component="topic/locked"]').toggleClass('hide', !data.isLocked);
	}

	function onTopicMoved(data) {
		getTopicEl(data.tid).remove();
	}

	function onTopicPurged(data) {
		getTopicEl(data.tid).remove();
	}

	function handlePinnedTopicSort() {
		var env = utils.findBootstrapEnvironment();
		if (!ajaxify.data.privileges.isAdminOrMod || env === 'xs' || env === 'sm') {
			return;
		}
		app.loadJQueryUI(function () {
			$('[component="category"]').sortable({
				items: '[component="category/topic"].pinned',
				update: function () {
					var data = [];

					var pinnedTopics = $('[component="category/topic"].pinned');
					pinnedTopics.each(function (index, element) {
						data.push({ tid: $(element).attr('data-tid'), order: pinnedTopics.length - index - 1 });
					});

					socket.emit('topics.orderPinnedTopics', data, function (err) {
						if (err) {
							return app.alertError(err.message);
						}
					});
				},
			});
		});
	}

	return CategoryTools;
});
