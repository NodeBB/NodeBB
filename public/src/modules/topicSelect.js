'use strict';


define('topicSelect', ['components'], function (components) {
	const TopicSelect = {};
	let lastSelectedTopic;

	let topicsContainer;

	TopicSelect.init = function (onSelect, onLongPress, containerEl) {
		topicsContainer = containerEl || $('[component="category"]');
		topicsContainer.on('selectstart', '[component="topic/select"]', function (ev) {
			ev.preventDefault();
		});

		let isLongPress = false;
		const click = function (ev) {
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
		};
		topicsContainer.on('click', '[component="topic/select"]', function (ev) {
			if (isLongPress) {
				ev.preventDefault();
				ev.stopImmediatePropagation();
				return false;
			}

			click.call(this, ev);
		});

		// Long press
		let longPressTimeout;
		const start = function (ev) {
			isLongPress = false;
			longPressTimeout = setTimeout(() => {
				isLongPress = true;
				click.call(this, ev);
				if (navigator.vibrate) {
					navigator.vibrate(50);
				}
				const topicEl = this.closest('[component="category/topic"]');
				if (topicEl.classList.contains('selected')) {
					onLongPress();
				}
			}, 500);
		};
		const cancel = () => {
			clearTimeout(longPressTimeout);
		};
		topicsContainer.on('mousedown', '[component="topic/select"]', start);
		topicsContainer.on('touchstart', '[component="topic/select"]', start);
		topicsContainer.on('mouseup', '[component="topic/select"]', cancel);
		topicsContainer.on('mouseleave', '[component="topic/select"]', cancel);
		topicsContainer.on('touchend', '[component="topic/select"]', cancel);
		topicsContainer.on('touchcancel', '[component="topic/select"]', cancel);
		topicsContainer.on('contextmenu', '[component="topic/select"]', (e) => {
			e.preventDefault();
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
