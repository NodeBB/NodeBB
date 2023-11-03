'use strict';


define('forum/account/categories', ['forum/account/header', 'alerts', 'api'], function (header, alerts, api) {
	const Categories = {};

	Categories.init = function () {
		header.init();

		ajaxify.data.categories.forEach(function (category) {
			handleIgnoreWatch(category.cid);
		});

		$('[component="category/watch/all"]').find(
			'[component="category/watching"], [component="category/tracking"], [component="category/ignoring"], [component="category/notwatching"]'
		).on('click', async (e) => {
			const cids = [];
			const state = e.currentTarget.getAttribute('data-state');
			const { uid } = ajaxify.data;
			$('[data-parent-cid="0"]').each(function (index, el) {
				cids.push($(el).attr('data-cid'));
			});

			let modified_cids = await Promise.all(cids.map(async cid => api.put(`/categories/${cid}/watch`, { state, uid })));
			modified_cids = modified_cids
				.reduce((memo, cur) => memo.concat(cur.modified), [])
				.filter((cid, idx, arr) => arr.indexOf(cid) === idx);

			updateDropdowns(modified_cids, state);
		});
	};

	function handleIgnoreWatch(cid) {
		const category = $('[data-cid="' + cid + '"]');
		category.find(
			'[component="category/watching"], [component="category/tracking"], [component="category/ignoring"], [component="category/notwatching"]'
		).on('click', async (e) => {
			const state = e.currentTarget.getAttribute('data-state');
			const { uid } = ajaxify.data;

			const { modified } = await api.put(`/categories/${cid}/watch`, { state, uid });
			updateDropdowns(modified, state);
			alerts.success('[[category:' + state + '.message]]');
		});
	}

	function updateDropdowns(modified_cids, state) {
		modified_cids.forEach(function (cid) {
			const category = $('[data-cid="' + cid + '"]');
			category.find('[component="category/watching/menu"]').toggleClass('hidden', state !== 'watching');
			category.find('[component="category/watching/check"]').toggleClass('fa-check', state === 'watching');

			category.find('[component="category/tracking/menu"]').toggleClass('hidden', state !== 'tracking');
			category.find('[component="category/tracking/check"]').toggleClass('fa-check', state === 'tracking');

			category.find('[component="category/notwatching/menu"]').toggleClass('hidden', state !== 'notwatching');
			category.find('[component="category/notwatching/check"]').toggleClass('fa-check', state === 'notwatching');

			category.find('[component="category/ignoring/menu"]').toggleClass('hidden', state !== 'ignoring');
			category.find('[component="category/ignoring/check"]').toggleClass('fa-check', state === 'ignoring');
		});
	}

	return Categories;
});
