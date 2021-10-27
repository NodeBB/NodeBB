'use strict';

define('groupSearch', function () {
	const groupSearch = {};

	groupSearch.init = function (el) {
		if (utils.isTouchDevice()) {
			return;
		}
		const searchEl = el.find('[component="group-selector-search"]');
		if (!searchEl.length) {
			return;
		}
		const toggleVisibility = searchEl.parent('[component="group-selector"]').length > 0;

		const groupEls = el.find('[component="group-list"] [data-name]');
		el.on('show.bs.dropdown', function () {
			function updateList() {
				const val = searchEl.find('input').val().toLowerCase();
				let noMatch = true;
				groupEls.each(function () {
					const liEl = $(this);
					const isMatch = liEl.attr('data-name').toLowerCase().indexOf(val) !== -1;
					if (noMatch && isMatch) {
						noMatch = false;
					}

					liEl.toggleClass('hidden', !isMatch);
				});

				el.find('[component="group-list"] [component="group-no-matches"]').toggleClass('hidden', !noMatch);
			}
			if (toggleVisibility) {
				el.find('.dropdown-toggle').addClass('hidden');
				searchEl.removeClass('hidden');
			}

			searchEl.on('click', function (ev) {
				ev.preventDefault();
				ev.stopPropagation();
			});
			searchEl.find('input').val('').on('keyup', updateList);
			updateList();
		});

		el.on('shown.bs.dropdown', function () {
			searchEl.find('input').focus();
		});

		el.on('hide.bs.dropdown', function () {
			if (toggleVisibility) {
				el.find('.dropdown-toggle').removeClass('hidden');
				searchEl.addClass('hidden');
			}
			searchEl.off('click').find('input').off('keyup');
		});
	};

	return groupSearch;
});
