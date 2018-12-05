'use strict';

define('forum/topic/diffs', ['forum/topic/images', 'benchpress', 'translator'], function (Images, Benchpress, translator) {
	var Diffs = {};

	Diffs.open = function (pid) {
		if (!config.enablePostHistory) {
			return;
		}

		var localeStringOpts = { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric' };

		socket.emit('posts.getDiffs', { pid: pid }, function (err, timestamps) {
			if (err) {
				return app.alertError(err.message);
			}

			Benchpress.parse('partials/modals/post_history', {
				diffs: timestamps.map(function (timestamp) {
					timestamp = parseInt(timestamp, 10);

					return {
						timestamp: timestamp,
						pretty: new Date(timestamp).toLocaleString(config.userLang.replace('_', '-'), localeStringOpts),
					};
				}),
				numDiffs: timestamps.length,
			}, function (html) {
				translator.translate(html, function (html) {
					var modal = bootbox.dialog({
						title: '[[topic:diffs.title]]',
						message: html,
						size: 'large',
					});

					if (!timestamps.length) {
						return;
					}

					var selectEl = modal.find('select');
					var postContainer = modal.find('ul.posts-list');

					selectEl.on('change', function () {
						Diffs.load(pid, this.value, postContainer);
					});

					modal.on('shown.bs.modal', function () {
						Diffs.load(pid, selectEl.val(), postContainer);
					});
				});
			});
		});
	};

	Diffs.load = function (pid, since, postContainer) {
		if (!config.enablePostHistory) {
			return;
		}

		socket.emit('posts.showPostAt', { pid: pid, since: since }, function (err, data) {
			if (err) {
				return app.alertError(err.message);
			}

			data.deleted = !!parseInt(data.deleted, 10);

			app.parseAndTranslate('partials/posts_list', 'posts', {
				posts: [data],
			}, function (html) {
				postContainer.empty().append(html);
			});
		});
	};

	return Diffs;
});
