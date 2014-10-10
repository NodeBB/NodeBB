"use strict";

/* globals define, bootbox */

define(function() {
	var iconSelect = {};

	iconSelect.init = function(el, onModified) {
		onModified = onModified || function() {};
		var selected = el.attr('class').replace('fa-2x', '').replace('fa', '').replace(/\s+/g, '');
		$('#icons .selected').removeClass('selected');

		if (selected === '') {
			selected = 'fa-doesnt-exist';
		}
		if (selected) {
			$('#icons .fa-icons .fa.' + selected).parent().addClass('selected');
		}

		bootbox.confirm('<h2>Select an icon.</h2>' + $('#icons').html(), function(confirm) {
			if (confirm) {
				var iconClass = $('.bootbox .selected').attr('class');
				var categoryIconClass = $('<div/>').addClass(iconClass).removeClass('fa').removeClass('selected').attr('class');
				if (categoryIconClass === 'fa-doesnt-exist') {
					categoryIconClass = '';
				}

				el.attr('class', 'fa fa-2x ' + categoryIconClass);
				el.val(categoryIconClass);
				el.attr('value', categoryIconClass);

				onModified(el);
			}
		});

		setTimeout(function() {
			$('.bootbox .fa-icons i').on('click', function() {
				$('.bootbox .selected').removeClass('selected');
				$(this).addClass('selected');
			});
		}, 500);
	};

	return iconSelect;
});

