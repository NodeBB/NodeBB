'use strict';


define('forum/account/categories', ['forum/account/header', 'alerts'], function (header, alerts) {
	const Categories = {};

	Categories.init = function () {
		header.init();

		ajaxify.data.categories.forEach(function (category) {
			handleIgnoreWatch(category.cid);
		});

		$('[component="category/watch/all"]').find('[component="category/watching"], [component="category/ignoring"], [component="category/notwatching"]').on('click', function () {
			const cids = [];
			const state = $(this).attr('data-state');
			$('[data-parent-cid="0"]').each(function (index, el) {
				cids.push($(el).attr('data-cid'));
			});

			socket.emit('categories.setWatchState', { cid: cids, state: state, uid: ajaxify.data.uid }, function (err, modified_cids) {
				if (err) {
					return alerts.error(err);
				}
				updateDropdowns(modified_cids, state);
			});
		});
	};

	function handleIgnoreWatch(cid) {
		const category = $('[data-cid="' + cid + '"]');
		category.find('[component="category/watching"], [component="category/ignoring"], [component="category/notwatching"]').on('click', function () {
			const $this = $(this);
			const state = $this.attr('data-state');

			socket.emit('categories.setWatchState', { cid: cid, state: state, uid: ajaxify.data.uid }, function (err, modified_cids) {
				if (err) {
					return alerts.error(err);
				}
				updateDropdowns(modified_cids, state);

				alerts.success('[[category:' + state + '.message]]');
			});
		});
	}

	function updateDropdowns(modified_cids, state) {
		modified_cids.forEach(function (cid) {
			const category = $('[data-cid="' + cid + '"]');
			category.find('[component="category/watching/menu"]').toggleClass('hidden', state !== 'watching');
			category.find('[component="category/watching/check"]').toggleClass('fa-check', state === 'watching');

			category.find('[component="category/notwatching/menu"]').toggleClass('hidden', state !== 'notwatching');
			category.find('[component="category/notwatching/check"]').toggleClass('fa-check', state === 'notwatching');

			category.find('[component="category/ignoring/menu"]').toggleClass('hidden', state !== 'ignoring');
			category.find('[component="category/ignoring/check"]').toggleClass('fa-check', state === 'ignoring');
		});
	}

	return Categories;
});
