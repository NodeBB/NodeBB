'use strict';

define('forum/tag', [
	'topicList', 'api', 'alerts', 'hooks', 'translator', 'bootstrap', 'components',
], function (topicList, api, alerts, hooks, translator, bootstrap, components) {
	const Tag = {};

	Tag.init = function () {
		app.enterRoom('tags');

		topicList.init('tag');

		$('[component="tag/following"]').on('click', function () {
			changeWatching('follow', 'put');
		});

		$('[component="tag/not-following"]').on('click', function () {
			changeWatching('unfollow', 'del');
		});

		function changeWatching(type, method) {
			api[method](`/tags/${ajaxify.data.tag}/follow`, {}).then(() => {
				let message = '';
				if (type === 'follow') {
					message = '[[tags:following-tag.message]]';
				} else if (type === 'unfollow') {
					message = '[[tags:not-following-tag.message]]';
				}

				setFollowState(type);

				alerts.alert({
					alert_id: 'follow_tag',
					message: message,
					type: type === 'follow' ? 'success' : 'info',
					timeout: 5000,
				});

				hooks.fire('action:tags.changeWatching', { tag: ajaxify.data.tag, type: type });
			}).catch(err => alerts.error(err));
		}

		function setFollowState(state) {
			const titles = {
				follow: '[[tags:watching]]',
				unfollow: '[[tags:not-watching]]',
			};

			translator.translate(titles[state], function (translatedTitle) {
				const tooltip = bootstrap.Tooltip.getInstance('[component="tag/watch"]');
				if (tooltip) {
					tooltip.setContent({ '.tooltip-inner': translatedTitle });
				}
			});

			let menu = components.get('tag/following/menu');
			menu.toggleClass('hidden', state !== 'follow');
			components.get('tag/following/check').toggleClass('fa-check', state === 'follow');

			menu = components.get('tag/not-following/menu');
			menu.toggleClass('hidden', state !== 'unfollow');
			components.get('tag/not-following/check').toggleClass('fa-check', state === 'unfollow');
		}
	};

	return Tag;
});
