'use strict';


define('forum/unread', [
	'forum/header/unread', 'topicSelect', 'components', 'topicList', 'categorySelector', 'alerts', 'api',
], function (headerUnread, topicSelect, components, topicList, categorySelector, alerts, api) {
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

				alerts.success('[[unread:topics-marked-as-read.success]]');

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

			Promise.all(tids.map(async tid => api.put(`/topics/${tid}/read`))).then(() => {
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

		// Generate list of default categories based on topic list
		let defaultCategories = ajaxify.data.topics.reduce((map, topic) => {
			const { category } = topic;
			let { cid } = category;
			cid = utils.isNumber(cid) ? parseInt(cid, 10) : cid;
			map.set(cid, category);
			return map;
		}, new Map());
		defaultCategories = Array.from(defaultCategories.values());

		const selector = categorySelector.init($('[component="category-selector"]'), {
			onSelect: function (category) {
				selector.selectCategory(0);
				if (category.cid === 'all') {
					markAllRead();
				} else if (category.cid === 'selected') {
					markSelectedRead();
				} else if (category.cid) {
					markCategoryRead(category.cid);
				}
			},
			selectCategoryLabel: ajaxify.data.selectCategoryLabel || '[[unread:mark-as-read]]',
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
			defaultCategories,
		});
	}

	function doneRemovingTids(tids) {
		removeTids(tids);

		alerts.success('[[unread:topics-marked-as-read.success]]');

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
