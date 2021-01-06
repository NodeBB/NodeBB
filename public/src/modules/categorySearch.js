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
		var toggleVisibility = searchEl.parent('[component="category/dropdown"]').length > 0 ||
			searchEl.parent('[component="category-selector"]').length > 0;

		var listEl = el.find('[component="category/list"]');
		var clonedList = listEl.clone();
		var categoryEls = clonedList.find('[data-cid]');

		el.on('show.bs.dropdown', function () {
			var cidToParentCid = {};

			function revealParents(cid) {
				var parentCid = cidToParentCid[cid];
				if (parentCid) {
					clonedList.find('[data-cid="' + parentCid + '"]').removeClass('hidden');
					revealParents(parentCid);
				}
			}

			function revealChildren(cid) {
				var els = clonedList.find('[data-parent-cid="' + cid + '"]');
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
					var isMatch = cids.length < 100 && (!val || (val.length > 1 && liEl.attr('data-name').toLowerCase().indexOf(val) !== -1));
					if (noMatch && isMatch) {
						noMatch = false;
					}
					if (isMatch && val) {
						var cid = liEl.attr('data-cid');
						cids.push(cid);
						cidToParentCid[cid] = parseInt(liEl.attr('data-parent-cid'), 10);
					}
					liEl.toggleClass('hidden', !isMatch).find('[component="category-markup"]').css({ 'font-weight': val && isMatch ? 'bold' : 'normal' });
				});

				cids.forEach(function (cid) {
					revealParents(cid);
					revealChildren(cid);
				});

				listEl.html(clonedList.html());
				el.find('[component="category/list"] [component="category/no-matches"]').toggleClass('hidden', !noMatch);
			}
			if (toggleVisibility) {
				el.find('.dropdown-toggle').addClass('hidden');
				searchEl.removeClass('hidden');
			}

			searchEl.on('click', function (ev) {
				ev.preventDefault();
				ev.stopPropagation();
			});
			searchEl.find('input').val('').on('keyup', utils.debounce(updateList, 200));
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

			searchEl.off('click');
			searchEl.find('input').off('keyup');
		});
	};

	return categorySearch;
});
