'use strict';


define('forum/categories', ['categorySelector', 'modals', 'benchpress'], function (categorySelector, modals, benchpress) {
	const categories = {};

	categories.init = async function () {
		app.enterRoom('categories');

		categorySelector.init($('[component="category-selector"]'), {
			privilege: 'find',
			onSelect: function (category) {
				ajaxify.go('/category/' + category.cid);
			},
		});

		if (ajaxify.data.firstRun) {
			const html = await benchpress.render('modals/first-run');
			modals.dialog({
				title: '[[category:first-run.welcome]]',
				message: html,
				backdrop: true,
				scrollback: false,
				closeButton: true,
			});
		}
	};

	return categories;
});
