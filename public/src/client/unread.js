'use strict';


define('forum/unread', [
	'forum/header/unread', 'topicSelect', 'components', 'topicList', 'categorySelector', 'alerts',
], function (headerUnread, topicSelect, components, topicList, categorySelector, alerts) {
	const Unread = {};

	Unread.init = function () {
		app.enterRoom('unread_topics');

		handleMarkRead();

		topicList.init('unread');

		headerUnread.updateUnreadTopicCount('/' + ajaxify.data.selectedFilter.url, ajaxify.data.topicCount);
	};

	function handleMarkRead() {
		function markAllRead() {
			socket.emit('topics.markAllRead', function (err) {
				if (err) {
					return alerts.error(err);
				}

				alerts.success('[[unread:topics_marked_as_read.success]]');

				$('[component="category"]').empty();
				$('[component="pagination"]').addClass('hidden');
				$('#category-no-topics').removeClass('hidden');
				$('.markread').addClass('hidden');
			});
		}

		function markSelectedRead() {
			const tids = topicSelect.getSelectedTids();
			if (!tids.length) {
				return;
			}
			socket.emit('topics.markAsRead', tids, function (err) {
				if (err) {
					return alerts.error(err);
				}

				doneRemovingTids(tids);
			});
		}

		function markCategoryRead(cid) {
			function getCategoryTids(cid) {
				const tids = [];
				components.get('category/topic', 'cid', cid).each(function () {
					tids.push($(this).attr('data-tid'));
				});
				return tids;
			}
			const tids = getCategoryTids(cid);

			socket.emit('topics.markCategoryTopicsRead', cid, function (err) {
				if (err) {
					return alerts.error(err);
				}

				doneRemovingTids(tids);
			});
		}
		const selector = categorySelector.init($('[component="category-selector"]'), {
			onSelect: function (category) {
				selector.selectCategory(0);
				if (category.cid === 'all') {
					markAllRead();
				} else if (category.cid === 'selected') {
					markSelectedRead();
				} else if (parseInt(category.cid, 10) > 0) {
					markCategoryRead(category.cid);
				}
			},
			selectCategoryLabel: ajaxify.data.selectCategoryLabel || '[[unread:mark_as_read]]',
			localCategories: [
				{
					cid: 'selected',
					name: '[[unread:selected]]',
					icon: '',
				},
				{
					cid: 'all',
					name: '[[unread:all]]',
					icon: '',
				},
			],
		});
	}

	function doneRemovingTids(tids) {
		removeTids(tids);

		alerts.success('[[unread:topics_marked_as_read.success]]');

		if (!$('[component="category"]').children().length) {
			$('#category-no-topics').removeClass('hidden');
			$('.markread').addClass('hidden');
		}
	}

	function removeTids(tids) {
		for (let i = 0; i < tids.length; i += 1) {
			components.get('category/topic', 'tid', tids[i]).remove();
		}
	}

	return Unread;
});
