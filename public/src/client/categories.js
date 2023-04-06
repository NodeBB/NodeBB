'use strict';


define('forum/categories', ['categorySelector'], function (categorySelector) {
	const categories = {};

	categories.init = function () {
		app.enterRoom('categories');

		categorySelector.init($('[component="category-selector"]'), {
			privilege: 'find',
			onSelect: function (category) {
				ajaxify.go('/category/' + category.cid);
			},
		});
	};

	return categories;
});
