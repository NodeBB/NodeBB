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
		category.find('[component="category/watching"], [component="category/ignoring"], [component="category/notwatching"]').on('click', function () {
			var $this = $(this);
			var state = $this.attr('data-state');

			socket.emit('categories.setWatchState', { cid: cid, state: state, uid: ajaxify.data.uid }, function (err, modified_cids) {
				if (err) {
					return app.alertError(err.message);
				}

				modified_cids.forEach(function (cid) {
					var category = $('[data-cid="' + cid + '"]');
					category.find('[component="category/watching/menu"]').toggleClass('hidden', state !== 'watching');
					category.find('[component="category/watching/check"]').toggleClass('fa-check', state === 'watching');

					category.find('[component="category/notwatching/menu"]').toggleClass('hidden', state !== 'notwatching');
					category.find('[component="category/notwatching/check"]').toggleClass('fa-check', state === 'notwatching');

					category.find('[component="category/ignoring/menu"]').toggleClass('hidden', state !== 'ignoring');
					category.find('[component="category/ignoring/check"]').toggleClass('fa-check', state === 'ignoring');
				});

				app.alertSuccess('[[category:' + state + '.message]]');
			});
		});
	}

	return Categories;
});
