"use strict";

/* globals define, bootbox, templates */

define('iconSelect', function() {
	var iconSelect = {};

	iconSelect.init = function(el, onModified) {
		onModified = onModified || function() {};
		var doubleSize = el.hasClass('fa-2x'),
			selected = el.attr('class').replace('fa-2x', '').replace('fa', '').replace(/\s+/g, '');

		$('#icons .selected').removeClass('selected');

		if (selected) {
			$('#icons .fa-icons .fa.' + selected).addClass('selected');
		}

		templates.parse('partials/fontawesome', {}, function(html) {
			var picker = bootbox.dialog({
					onEscape: true,
					backdrop: true,
					message: html,
					title: 'Select an Icon',
					buttons: {
						noIcon: {
							label: 'No Icon',
							className: 'btn-default',
							callback: function() {
								el.attr('class', 'fa ' + (doubleSize ? 'fa-2x ' : ''));
								el.val('');
								el.attr('value', '');

								onModified(el);
							}
						},
						success: {
							label: 'Select',
							className: 'btn-primary',
							callback: function(confirm) {
								var iconClass = $('.bootbox .selected').attr('class');
								var categoryIconClass = $('<div/>').addClass(iconClass).removeClass('fa').removeClass('selected').attr('class');

								el.attr('class', 'fa ' + (doubleSize ? 'fa-2x ' : '') + categoryIconClass);
								el.val(categoryIconClass);
								el.attr('value', categoryIconClass);

								onModified(el);
							}
						}
					}
				});

			picker.on('shown.bs.modal', function() {
				var modalEl = $(this),
					searchEl = modalEl.find('input'),
					icons = modalEl.find('.fa-icons i'),
					submitEl = modalEl.find('button.btn-primary');

				// Focus on the input box
				searchEl.focus();

				if (selected) {
					modalEl.find('.icon-container .' + selected).addClass('selected');
				}

				modalEl.find('.icon-container').on('click', 'i', function() {
					searchEl.val($(this).attr('class').replace('fa fa-', '').replace('selected', ''));
					modalEl.find('.icon-container i').removeClass('selected');
					$(this).addClass('selected');
				});

				searchEl.on('keyup', function(e) {
					if (e.keyCode !== 13) {
						// Filter
						icons.show();
						icons.each(function(idx, el) {
							if (!el.className.match(new RegExp('^fa fa-.*' + searchEl.val() + '.*$'))) {
								$(el).hide();
							}
						});
					} else {
						// Pick first match
						$('.icon-container i:visible').first().addClass('selected');
						submitEl.click();
					}
				});
			});
		});
	};

	return iconSelect;
});

