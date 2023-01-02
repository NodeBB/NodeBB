'use strict';

define('persona/quickreply', [
	'components', 'composer', 'composer/autocomplete', 'api',
	'alerts', 'uploadHelpers', 'mousetrap',
], function (
	components, composer, autocomplete, api,
	alerts, uploadHelpers, mousetrap
) {
	var QuickReply = {};

	QuickReply.init = function () {
		var element = components.get('topic/quickreply/text');
		var data = {
			element: element,
			strategies: [],
			options: {
				style: {
					'z-index': 100,
				},
			},
		};

		$(window).trigger('composer:autocomplete:init', data);
		autocomplete._active.persona_qr = autocomplete.setup(data);
		// data.element.textcomplete(data.strategies, data.options);
		// $('.textcomplete-wrapper').css('height', '100%').find('textarea').css('height', '100%');

		mousetrap.bind('ctrl+return', (e) => {
			if (e.target === element.get(0)) {
				components.get('topic/quickreply/button').get(0).click();
			}
		});

		uploadHelpers.init({
			dragDropAreaEl: $('[component="topic/quickreply/container"] .quickreply-message'),
			pasteEl: element,
			uploadFormEl: $('[component="topic/quickreply/upload"]'),
			inputEl: element,
			route: '/api/post/upload',
			callback: function (uploads) {
				let text = element.val();
				uploads.forEach((upload) => {
					text = text + (text ? '\n' : '') + (upload.isImage ? '!' : '') + `[${upload.filename}](${upload.url})`;
				});
				element.val(text);
			},
		});

		var ready = true;
		components.get('topic/quickreply/button').on('click', function (e) {
			e.preventDefault();
			if (!ready) {
				return;
			}

			var replyMsg = components.get('topic/quickreply/text').val();
			var replyData = {
				tid: ajaxify.data.tid,
				handle: undefined,
				content: replyMsg,
			};

			ready = false;
			api.post(`/topics/${ajaxify.data.tid}`, replyData, function (err, data) {
				ready = true;
				if (err) {
					return alerts.error(err);
				}
				if (data && data.queued) {
					alerts.alert({
						type: 'success',
						title: '[[global:alert.success]]',
						message: data.message,
						timeout: 10000,
						clickfn: function () {
							ajaxify.go(`/post-queue/${data.id}`);
						},
					});
				}

				components.get('topic/quickreply/text').val('');
				autocomplete._active.persona_qr.hide();
			});
		});

		components.get('topic/quickreply/expand').on('click', (e) => {
			e.preventDefault();

			const textEl = components.get('topic/quickreply/text');
			composer.newReply(ajaxify.data.tid, undefined, ajaxify.data.title, utils.escapeHTML(textEl.val()));
			textEl.val('');
		});
	};

	return QuickReply;
});
