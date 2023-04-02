'use strict';


define('topicSelect', ['components'], function (components) {
	const TopicSelect = {};
	let lastSelectedTopic;

	let topicsContainer;

	TopicSelect.init = function (onSelect) {
		topicsContainer = $('[component="category"]');
		topicsContainer.on('selectstart', '[component="topic/select"]', function (ev) {
			ev.preventDefault();
		});

		topicsContainer.on('click', '[component="topic/select"]', function (ev) {
			const select = $(this);
			const topicEl = select.parents('[component="category/topic"]');
			if (ev.shiftKey) {
				selectRange(topicEl.attr('data-tid'));
				lastSelectedTopic = topicEl;
				return false;
			}

			const isSelected = topicEl.hasClass('selected');
			toggleSelected(topicEl, !isSelected);
			lastSelectedTopic = topicEl;
			if (typeof onSelect === 'function') {
				onSelect();
			}
		});
	};

	function toggleSelected(topicEl, isSelected) {
		const select = topicEl.find('[component="topic/select"]');
		select.toggleClass('fa-check-square-o', isSelected);
		select.toggleClass('fa-square-o', !isSelected);
		select.parents('[component="category/topic"]').toggleClass('selected', isSelected);
		updateSelectedBadgeCount();
	}

	function updateSelectedBadgeCount() {
		const badge = $('[component="topic/selected/badge"]');
		if (badge.length) {
			const count = topicsContainer.find('[component="category/topic"].selected').length;
			badge.text(count > 0 ? count : '');
		}
	}

	TopicSelect.getSelectedTids = function () {
		const tids = [];
		if (!topicsContainer) {
			return tids;
		}
		topicsContainer.find('[component="category/topic"].selected').each(function () {
			tids.push($(this).attr('data-tid'));
		});
		return tids;
	};

	TopicSelect.unselectAll = function () {
		if (topicsContainer) {
			topicsContainer.find('[component="category/topic"].selected').removeClass('selected');
			topicsContainer.find('[component="topic/select"]').toggleClass('fa-check-square-o', false).toggleClass('fa-square-o', true);
			updateSelectedBadgeCount();
		}
	};

	function selectRange(clickedTid) {
		if (!lastSelectedTopic) {
			lastSelectedTopic = $('[component="category/topic"]').first();
		}

		const isClickedSelected = components.get('category/topic', 'tid', clickedTid).hasClass('selected');

		const clickedIndex = getIndex(clickedTid);
		const lastIndex = getIndex(lastSelectedTopic.attr('data-tid'));
		selectIndexRange(clickedIndex, lastIndex, !isClickedSelected);
	}

	function selectIndexRange(start, end, isSelected) {
		if (start > end) {
			const tmp = start;
			start = end;
			end = tmp;
		}

		for (let i = start; i <= end; i += 1) {
			const topic = $('[component="category/topic"]').eq(i);
			toggleSelected(topic, isSelected);
		}
	}

	function getIndex(tid) {
		return components.get('category/topic', 'tid', tid).index('[component="category/topic"]');
	}

	return TopicSelect;
});
