"use strict";

/* globals define, bootbox */

define('iconSelect', ['nodebb-templatist'], function(templatist) {
	var iconSelect = {};

	iconSelect.init = function(el, onModified) {
		onModified = onModified || function() {};
		var doubleSize = el.hasClass('fa-2x'),
			selected = el.attr('class').replace('fa-2x', '').replace('fa', '').replace(/\s+/g, '');

		$('#icons .selected').removeClass('selected');

		if (selected === '') {
			selected = 'fa-doesnt-exist';
		}
		if (selected) {
			$('#icons .fa-icons .fa.' + selected).addClass('selected');
		}

		templatist.render('partials/fontawesome', {}, function(err, html) {
			var picker = bootbox.dialog({
					message: html,
					title: 'Select an Icon',
					buttons: {
						success: {
							label: 'Save',
							callback: function(confirm) {
								var iconClass = $('.bootbox .selected').attr('class');
								var categoryIconClass = $('<div/>').addClass(iconClass).removeClass('fa').removeClass('selected').attr('class');
								if (categoryIconClass === 'fa-doesnt-exist') {
									categoryIconClass = '';
								}

								el.attr('class', 'fa ' + (doubleSize ? 'fa-2x ' : '') + categoryIconClass);
								el.val(categoryIconClass);
								el.attr('value', categoryIconClass);

								onModified(el);
							}
						}
					}
				});

			picker.on('shown.bs.modal', function() {
				var modalEl = $(this);
				modalEl.find('.icon-container').on('click', 'i', function() {
					modalEl.find('.icon-container i').removeClass('selected');
					$(this).addClass('selected');
				});
			});
		});
	};

	return iconSelect;
});
