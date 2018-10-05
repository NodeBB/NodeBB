'use strict';


define('forum/account/categories', ['forum/account/header'], function (header) {
	var Categories = {};

	Categories.init = function () {
		header.init();

		ajaxify.data.categories.forEach(function (category) {
			handleIgnoreWatch(category.cid);
		});
	};

	function handleIgnoreWatch(cid) {
		var category = $('[data-cid="' + cid + '"]');
		category.find('[component="category/watching"], [component="category/ignoring"]').on('click', function () {
			var $this = $(this);
			var command = $this.attr('component') === 'category/watching' ? 'watch' : 'ignore';

			socket.emit('categories.' + command, { cid: cid, uid: ajaxify.data.uid }, function (err, modified_cids) {
				if (err) {
					return app.alertError(err.message);
				}

				modified_cids.forEach(function (cid) {
					var category = $('[data-cid="' + cid + '"]');
					category.find('[component="category/watching/menu"]').toggleClass('hidden', command !== 'watch');
					category.find('[component="category/watching/check"]').toggleClass('fa-check', command === 'watch');

					category.find('[component="category/ignoring/menu"]').toggleClass('hidden', command !== 'ignore');
					category.find('[component="category/ignoring/check"]').toggleClass('fa-check', command === 'ignore');
				});

				app.alertSuccess('[[category:' + command + '.message]]');
			});
		});
	}

	return Categories;
});
