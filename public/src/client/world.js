'use strict';

define('forum/world', ['topicList', 'sort', 'hooks', 'alerts', 'api'], function (topicList, sort, hooks, alerts, api) {
	const World = {};

	World.init = function () {
		app.enterRoom('world');
		topicList.init('world');

		sort.handleSort('categoryTopicSort', 'world');

		handleIgnoreWatch(-1);

		hooks.fire('action:topics.loaded', { topics: ajaxify.data.topics });
		hooks.fire('action:category.loaded', { cid: ajaxify.data.cid });
	};

	function handleIgnoreWatch(cid) {
		$('[component="category/watching"], [component="category/tracking"], [component="category/ignoring"], [component="category/notwatching"]').on('click', function () {
			const $this = $(this);
			const state = $this.attr('data-state');

			api.put(`/categories/${cid}/watch`, { state }, (err) => {
				if (err) {
					return alerts.error(err);
				}

				$('[component="category/watching/menu"]').toggleClass('hidden', state !== 'watching');
				$('[component="category/watching/check"]').toggleClass('fa-check', state === 'watching');

				$('[component="category/tracking/menu"]').toggleClass('hidden', state !== 'tracking');
				$('[component="category/tracking/check"]').toggleClass('fa-check', state === 'tracking');

				$('[component="category/notwatching/menu"]').toggleClass('hidden', state !== 'notwatching');
				$('[component="category/notwatching/check"]').toggleClass('fa-check', state === 'notwatching');

				$('[component="category/ignoring/menu"]').toggleClass('hidden', state !== 'ignoring');
				$('[component="category/ignoring/check"]').toggleClass('fa-check', state === 'ignoring');

				alerts.success('[[category:' + state + '.message]]');
			});
		});
	}

	return World;
});
