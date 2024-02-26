'use strict';


define('forum/account/tags', [
	'forum/account/header', 'alerts', 'api', 'hooks', 'autocomplete',
], function (header, alerts, api, hooks, autocomplete) {
	const Tags = {};

	Tags.init = function () {
		header.init();

		const tagEl = $('[component="tags/watch"]');
		tagEl.tagsinput({
			tagClass: 'badge text-bg-info',
			confirmKeys: [13, 44],
			trimValue: true,
		});
		const input = tagEl.siblings('.bootstrap-tagsinput').find('input');
		input.translateAttr('aria-label', '[[aria:user-watched-tags]]');
		autocomplete.tag(input);

		ajaxify.data.tags.forEach(function (tag) {
			tagEl.tagsinput('add', tag);
		});

		tagEl.on('itemAdded', function (event) {
			if (input.length) {
				input.autocomplete('close');
			}
			api.put(`/tags/${event.item}/follow`, {}).then(() => {
				alerts.alert({
					alert_id: 'follow_tag',
					message: '[[tags:following-tag.message]]',
					type: 'success',
					timeout: 5000,
				});

				hooks.fire('action:tags.changeWatching', { tag: ajaxify.data.tag, type: 'follow' });
			}).catch(err => alerts.error(err));
		});

		tagEl.on('itemRemoved', function (event) {
			api.del(`/tags/${event.item}/follow`, {}).then(() => {
				alerts.alert({
					alert_id: 'follow_tag',
					message: '[[tags:not-following-tag.message]]',
					type: 'info',
					timeout: 5000,
				});

				hooks.fire('action:tags.changeWatching', { tag: ajaxify.data.tag, type: 'unfollow' });
			}).catch(err => alerts.error(err));
		});
	};

	return Tags;
});
