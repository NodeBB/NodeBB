
'use strict';


define('forum/category/tools', [
	'topicSelect',
	'components',
	'translator',
	'api',
	'bootbox',
], function (topicSelect, components, translator, api, bootbox) {
	var CategoryTools = {};

	CategoryTools.init = function () {
		topicSelect.init(updateDropdownOptions);

		handlePinnedTopicSort();

		components.get('topic/delete').on('click', function () {
			categoryCommand('del', '/state', 'delete', onDeletePurgeComplete);
			return false;
		});

		components.get('topic/restore').on('click', function () {
			categoryCommand('put', '/state', 'restore', onDeletePurgeComplete);
			return false;
		});

		components.get('topic/purge').on('click', function () {
			categoryCommand('del', '', 'purge', onDeletePurgeComplete);
			return false;
		});

		components.get('topic/lock').on('click', function () {
			categoryCommand('put', '/lock', 'lock', onCommandComplete);
			return false;
		});

		components.get('topic/unlock').on('click', function () {
			categoryCommand('del', '/lock', 'unlock', onCommandComplete);
			return false;
		});

		components.get('topic/pin').on('click', function () {
			categoryCommand('put', '/pin', 'pin', onCommandComplete);
			return false;
		});

		components.get('topic/unpin').on('click', function () {
			categoryCommand('del', '/pin', 'unpin', onCommandComplete);
			return false;
		});

		// todo: should also use categoryCommand, but no write api call exists for this yet
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
			require(['forum/topic/move'], function (move) {
				var tids = topicSelect.getSelectedTids();

				if (!tids.length) {
					return app.alertError('[[error:no-topics-selected]]');
				}
				move.init(tids, null, onCommandComplete);
			});

			return false;
		});

		components.get('topic/move-all').on('click', function () {
			var cid = ajaxify.data.cid;
			if (!ajaxify.data.template.category) {
				return app.alertError('[[error:invalid-data]]');
			}
			require(['forum/topic/move'], function (move) {
				move.init(null, cid, function (err) {
					if (err) {
						return app.alertError(err.message);
					}

					ajaxify.refresh();
				});
			});
		});

		components.get('topic/merge').on('click', function () {
			var tids = topicSelect.getSelectedTids();
			require(['forum/topic/merge'], function (merge) {
				merge.init(function () {
					if (tids.length) {
						tids.forEach(function (tid) {
							merge.addTopic(tid);
						});
					}
				});
			});
		});

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

	function categoryCommand(method, path, command, onComplete) {
		if (!onComplete) {
			onComplete = function () {};
		}
		const tids = topicSelect.getSelectedTids();
		const body = {};
		const execute = function (ok) {
			if (ok) {
				Promise.all(tids.map(tid => api[method](`/topics/${tid}${path}`, body)))
					.then(onComplete)
					.catch(app.alertError);
			}
		};

		if (!tids.length) {
			return app.alertError('[[error:no-topics-selected]]');
		}

		switch (command) {
			case 'delete':
			case 'restore':
			case 'purge':
				bootbox.confirm(`[[topic:thread_tools.${command}_confirm]]`, execute);
				break;

			case 'pin':
				requestPinExpiry(body, execute.bind(null, true));
				break;

			default:
				execute(true);
				break;
		}
	}

	function requestPinExpiry(body, onSuccess) {
		app.parseAndTranslate('modals/set-pin-expiry', {}, function (html) {
			const modal = bootbox.dialog({
				title: '[[topic:thread_tools.pin]]',
				message: html,
				onEscape: true,
				size: 'small',
				buttons: {
					save: {
						label: '[[global:save]]',
						className: 'btn-primary',
						callback: function () {
							const expiryEl = modal.get(0).querySelector('#expiry');
							let expiry = expiryEl.value;

							// No expiry set
							if (expiry === '') {
								return onSuccess();
							}

							// Expiration date set
							expiry = new Date(expiry);

							if (expiry && expiry.getTime() > Date.now()) {
								body.expiry = expiry.getTime();
								onSuccess();
							} else {
								app.alertError('[[error:invalid-date]]');
							}
						},
					},
				},
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

	function onCommandComplete() {
		closeDropDown();
		topicSelect.unselectAll();
	}

	function onDeletePurgeComplete() {
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
		if (!ajaxify.data.topics || !ajaxify.data.template.category) {
			return;
		}
		var numPinned = ajaxify.data.topics.reduce(function (memo, topic) {
			memo = topic.pinned ? memo += 1 : memo;
			return memo;
		}, 0);

		if ((!app.user.isAdmin && !app.user.isMod) || numPinned < 2) {
			return;
		}

		app.loadJQueryUI(function () {
			var topicListEl = $('[component="category"]').filter(function (i, e) {
				return !$(e).parents('[widget-area],[data-widget-area]').length;
			});
			topicListEl.sortable({
				handle: '[component="topic/pinned"]',
				items: '[component="category/topic"].pinned',
				update: function () {
					var data = [];

					var pinnedTopics = topicListEl.find('[component="category/topic"].pinned');
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
