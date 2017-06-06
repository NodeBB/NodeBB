'use strict';


define('categorySelector', function () {
	var categorySelector = {};
	var selectedCategory;
	var el;
	categorySelector.init = function (_el, callback) {
		callback = callback || function () {};
		el = _el;
		el.on('click', '[data-cid]', function () {
			var categoryEl = $(this);
			categorySelector.selectCategory(categoryEl.attr('data-cid'));
			callback(selectedCategory);
		});
	};

	categorySelector.getSelectedCategory = function () {
		return selectedCategory;
	};

	categorySelector.selectCategory = function (cid) {
		var categoryEl = el.find('[data-cid="' + cid + '"]');
		selectedCategory = {
			cid: cid,
			name: categoryEl.attr('data-name'),
		};
		el.find('[component="category-selector-selected"]').html(categoryEl.find('[component="category-markup"]').html());
	};

	return categorySelector;
});

