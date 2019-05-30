'use strict';

define('categorySearch', function () {
	var categorySearch = {};

	categorySearch.init = function (el) {
		if (utils.isTouchDevice()) {
			return;
		}
		var searchEl = el.find('[component="category-selector-search"]');
		if (!searchEl.length) {
			return;
		}
		var categoryEls = el.find('[component="category/list"] [data-cid]');
		el.on('show.bs.dropdown', function () {
			function revealParents(cid) {
				var parentCid = el.find('[component="category/list"] [data-cid="' + cid + '"]').attr('data-parent-cid');
				if (parentCid) {
					el.find('[component="category/list"] [data-cid="' + parentCid + '"]').removeClass('hidden');
					revealParents(parentCid);
				}
			}

			function revealChildren(cid) {
				var els = el.find('[component="category/list"] [data-parent-cid="' + cid + '"]');
				els.each(function (index, el) {
					var $el = $(el);
					$el.removeClass('hidden');
					revealChildren($el.attr('data-cid'));
				});
			}

			function updateList() {
				var val = searchEl.find('input').val().toLowerCase();
				var noMatch = true;
				var cids = [];
				categoryEls.each(function () {
					var liEl = $(this);
					var isMatch = liEl.attr('data-name').toLowerCase().indexOf(val) !== -1;
					if (noMatch && isMatch) {
						noMatch = false;
					}
					if (isMatch && val) {
						cids.push(liEl.attr('data-cid'));
					}
					liEl.toggleClass('hidden', !isMatch).find('[component="category-markup"]').css({ 'font-weight': val && isMatch ? 'bold' : 'normal' });
				});

				cids.forEach(function (cid) {
					revealParents(cid);
					revealChildren(cid);
				});

				el.find('[component="category/list"] [component="category/no-matches"]').toggleClass('hidden', !noMatch);
			}
			el.find('.dropdown-toggle').addClass('hidden');
			searchEl.removeClass('hidden').on('click', function (ev) {
				ev.preventDefault();
				ev.stopPropagation();
			});
			searchEl.find('input').val('').focus().on('keyup', updateList);
			updateList();
		});

		el.on('hide.bs.dropdown', function () {
			el.find('.dropdown-toggle').removeClass('hidden');
			searchEl.addClass('hidden').off('click');
			searchEl.find('input').off('keyup');
		});
	};

	return categorySearch;
});
