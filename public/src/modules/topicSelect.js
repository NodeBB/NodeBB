'use strict';

/* globals define*/

define(function() {
	var TopicSelect = {};

	TopicSelect.init = function(onSelect) {
		$('#topics-container').on('click', '.select', function() {
			var select = $(this);
			var isChecked = !select.hasClass('fa-square-o');

			select.toggleClass('fa-check-square-o', !isChecked);
			select.toggleClass('fa-square-o', isChecked);
			select.parents('.category-item').toggleClass('selected', !isChecked);
			if (typeof onSelect === 'function') {
				onSelect();
			}
		});
	};

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

	return TopicSelect;
});