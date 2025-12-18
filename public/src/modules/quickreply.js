'use strict';

define('quickreply', [
	'components', 'autocomplete', 'api',
	'alerts', 'uploadHelpers', 'mousetrap', 'storage', 'hooks',
], function (
	components, autocomplete, api,
	alerts, uploadHelpers, mousetrap, storage, hooks
) {
	const QuickReply = {
		_autocomplete: null,
	};

	QuickReply.init = function () {
		const element = components.get('topic/quickreply/text');
		const qrDraftId = `qr:draft:tid:${ajaxify.data.tid}`;
		const data = {
			element: element,
			strategies: [],
			options: {
				style: {
					'z-index': 100,
				},
			},
		};

		destroyAutoComplete();
		$(window).one('action:ajaxify.start', () => {
			destroyAutoComplete();
		});
		$(window).trigger('composer:autocomplete:init', data);
		QuickReply._autocomplete = autocomplete.setup(data);

		mousetrap.bind('ctrl+return', (e) => {
			if (e.target === element.get(0)) {
				components.get('topic/quickreply/button').get(0).click();
			}
		});

		uploadHelpers.init({
			uploadBtnEl: $('[component="topic/quickreply/upload/button"]'),
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

		let ready = true;
		components.get('topic/quickreply/button').on('click', function (e) {
			e.preventDefault();
			if (!ready) {
				return;
			}

			const replyMsg = element.val();
			const replyData = {
				tid: ajaxify.data.tid,
				handle: undefined,
				content: replyMsg,
			};
			const replyLen = replyMsg.length;
			if (replyLen < parseInt(config.minimumPostLength, 10)) {
				return alerts.error('[[error:content-too-short, ' + config.minimumPostLength + ']]');
			} else if (replyLen > parseInt(config.maximumPostLength, 10)) {
				return alerts.error('[[error:content-too-long, ' + config.maximumPostLength + ']]');
			}

			ready = false;
			element.val('');
			api.post(`/topics/${ajaxify.data.tid}`, replyData, function (err, data) {
				ready = true;
				if (err) {
					element.val(replyMsg);
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

				element.val('');
				storage.removeItem(qrDraftId);
				QuickReply._autocomplete.hide();
				hooks.fire('action:quickreply.success', { data });
			});
		});

		const draft = storage.getItem(qrDraftId);
		if (draft) {
			element.val(draft);
		}

		element.on('keyup', utils.debounce(function () {
			const text = element.val();
			if (text) {
				storage.setItem(qrDraftId, text);
			} else {
				storage.removeItem(qrDraftId);
			}
		}, 1000));

		components.get('topic/quickreply/expand').on('click', (e) => {
			e.preventDefault();
			storage.removeItem(qrDraftId);
			const textEl = components.get('topic/quickreply/text');
			hooks.fire('action:composer.post.new', {
				tid: ajaxify.data.tid,
				title: ajaxify.data.titleRaw,
				body: textEl.val(),
			});
			textEl.val('');
		});
	};

	function destroyAutoComplete() {
		if (QuickReply._autocomplete) {
			QuickReply._autocomplete.destroy();
			QuickReply._autocomplete = null;
		}
	}

	return QuickReply;
});
