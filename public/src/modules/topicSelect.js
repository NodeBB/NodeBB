'use strict';

/* globals define*/

define('topicSelect', function() {
	var TopicSelect = {};
	var lastSelected;

	TopicSelect.init = function(onSelect) {

		$('#topics-container').on('selectstart', function() {
			return false;
		});

		$('#topics-container').on('click', '.select', function(ev) {
			var select = $(this);

			if (ev.shiftKey) {
				selectRange($(this).parents('.category-item').attr('data-tid'));
				lastSelected = select;
				return false;
			}

			var isSelected = select.hasClass('fa-check-square-o');
			toggleSelect(select, !isSelected);
			lastSelected = select;
			if (typeof onSelect === 'function') {
				onSelect();
			}
		});
	};

	function toggleSelect(select, isSelected) {
		select.toggleClass('fa-check-square-o', isSelected);
		select.toggleClass('fa-square-o', !isSelected);
		select.parents('.category-item').toggleClass('selected', isSelected);
	}

	TopicSelect.getSelectedTids = function() {
		var tids = [];
		$('#topics-container .category-item.selected').each(function() {
			tids.push($(this).attr('data-tid'));
		});
		return tids;
	};

	TopicSelect.unselectAll = function() {
		$('#topics-container .category-item.selected').removeClass('selected');
		$('#topics-container .select').toggleClass('fa-check-square-o', false).toggleClass('fa-square-o', true);
	};

	function selectRange(clickedTid) {

		if(!lastSelected) {
			lastSelected = $('.category-item[data-tid]').first().find('.select');
		}

		var isClickedSelected = $('.category-item[data-tid="' + clickedTid + '"]').hasClass('selected');

		var clickedIndex = getIndex(clickedTid);
		var lastIndex = getIndex(lastSelected.parents('.category-item[data-tid]').attr('data-tid'));
		selectIndexRange(clickedIndex, lastIndex, !isClickedSelected);
	}

	function selectIndexRange(start, end, isSelected) {
		if (start > end) {
			var tmp = start;
			start = end;
			end = tmp;
		}

		for(var i=start; i<=end; ++i) {
			var topic = $('.category-item[data-tid]').eq(i);
			toggleSelect(topic.find('.select'), isSelected);
		}
	}

	function getIndex(tid) {
		return $('.category-item[data-tid="' + tid + '"]').index('.category-item');
	}

	return TopicSelect;
});