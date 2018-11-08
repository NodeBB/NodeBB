'use strict';


define('iconSelect', ['benchpress'], function (Benchpress) {
	var iconSelect = {};

	iconSelect.init = function (el, onModified) {
		onModified = onModified || function () {};
		var doubleSize = el.hasClass('fa-2x');
		var selected = el.attr('class').replace('fa-2x', '').replace('fa', '').replace(/\s+/g, '');

		$('#icons .selected').removeClass('selected');

		if (selected) {
			try {
				$('#icons .fa-icons .fa.' + selected).addClass('selected');
			} catch (err) {
				selected = '';
			}
		}

		Benchpress.parse('partials/fontawesome', {}, function (html) {
			html = $(html);
			html.find('.fa-icons').prepend($('<i class="fa fa-nbb-none"></i>'));

			var picker = bootbox.dialog({
				onEscape: true,
				backdrop: true,
				show: false,
				message: html,
				title: 'Select an Icon',
				buttons: {
					noIcon: {
						label: 'No Icon',
						className: 'btn-default',
						callback: function () {
							el.attr('class', 'fa ' + (doubleSize ? 'fa-2x ' : ''));
							el.val('');
							el.attr('value', '');

							onModified(el);
						},
					},
					success: {
						label: 'Select',
						className: 'btn-primary',
						callback: function () {
							var iconClass = $('.bootbox .selected').attr('class');
							var categoryIconClass = $('<div/>').addClass(iconClass).removeClass('fa').removeClass('selected')
								.attr('class');

							if (categoryIconClass) {
								el.attr('class', 'fa ' + (doubleSize ? 'fa-2x ' : '') + categoryIconClass);
								el.val(categoryIconClass);
								el.attr('value', categoryIconClass);
							}

							onModified(el);
						},
					},
				},
			});

			picker.on('show.bs.modal', function () {
				var modalEl = $(this);
				var searchEl = modalEl.find('input');

				if (selected) {
					modalEl.find('.' + selected).addClass('selected');
					searchEl.val(selected.replace('fa-', ''));
				}
			}).modal('show');

			picker.on('shown.bs.modal', function () {
				var modalEl = $(this);
				var searchEl = modalEl.find('input');
				var icons = modalEl.find('.fa-icons i');
				var submitEl = modalEl.find('button.btn-primary');

				function changeSelection(newSelection) {
					modalEl.find('i.selected').removeClass('selected');
					if (newSelection) {
						newSelection.addClass('selected');
					} else if (searchEl.val().length === 0) {
						if (selected) {
							modalEl.find('.' + selected).addClass('selected');
						}
					} else {
						modalEl.find('i:visible').first().addClass('selected');
					}
				}

				// Focus on the input box
				searchEl.selectRange(0, searchEl.val().length);

				modalEl.find('.icon-container').on('click', 'i', function () {
					searchEl.val($(this).attr('class').replace('fa fa-', '').replace('selected', ''));
					changeSelection($(this));
				});

				searchEl.on('keyup', function (e) {
					if (e.keyCode !== 13) {
						// Filter
						icons.show();
						icons.each(function (idx, el) {
							if (!el.className.match(new RegExp('^fa fa-.*' + searchEl.val() + '.*$'))) {
								$(el).hide();
							}
						});
						changeSelection();
					} else {
						submitEl.click();
					}
				});
			});
		});
	};

	return iconSelect;
});
