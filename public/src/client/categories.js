'use strict';


define('forum/categories', ['categorySelector', 'bootbox', 'translator'], function (categorySelector, bootbox, tx) {
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
			const html = await app.parseAndTranslate('modals/first-run');
			const title = await tx.translate(tx.compile('category:first-run.welcome'));
			bootbox.dialog({
				title,
				message: html,
				backdrop: true,
				scrollback: false,
				closeButton: true,
			});
		}
	};

	return categories;
});
