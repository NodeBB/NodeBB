'use strict';

define('forum/topic/diffs', ['api', 'forum/topic/images'], function (api) {
	var Diffs = {};

	Diffs.open = function (pid) {
		if (!config.enablePostHistory) {
			return;
		}

		var localeStringOpts = { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric' };

		api.get(`/posts/${pid}/diffs`, {}).then((data) => {
			app.parseAndTranslate('partials/modals/post_history', {
				diffs: data.revisions.map(function (revision) {
					var timestamp = parseInt(revision.timestamp, 10);

					return {
						username: revision.username,
						timestamp: timestamp,
						pretty: new Date(timestamp).toLocaleString(config.userLang.replace('_', '-'), localeStringOpts),
					};
				}),
				numDiffs: data.timestamps.length,
				editable: data.editable,
			}, function (html) {
				var modal = bootbox.dialog({
					title: '[[topic:diffs.title]]',
					message: html,
					size: 'large',
				});

				if (!data.timestamps.length) {
					return;
				}

				var selectEl = modal.find('select');
				var revertEl = modal.find('button[data-action="restore"]');
				var postContainer = modal.find('ul.posts-list');

				selectEl.on('change', function () {
					Diffs.load(pid, this.value, postContainer);
					revertEl.prop('disabled', data.timestamps.indexOf(this.value) === 0);
				});

				revertEl.on('click', function () {
					Diffs.restore(pid, selectEl.val(), modal);
				});

				modal.on('shown.bs.modal', function () {
					Diffs.load(pid, selectEl.val(), postContainer);
					revertEl.prop('disabled', true);
				});
			});
		}).catch(app.alertError);
	};

	Diffs.load = function (pid, since, postContainer) {
		if (!config.enablePostHistory) {
			return;
		}

		api.get(`/posts/${pid}/diffs/${since}`, {}).then((data) => {
			data.deleted = !!parseInt(data.deleted, 10);

			app.parseAndTranslate('partials/posts_list', 'posts', {
				posts: [data],
			}, function (html) {
				postContainer.empty().append(html);
			});
		}).catch(app.alertError);
	};

	Diffs.restore = function (pid, since, modal) {
		if (!config.enablePostHistory) {
			return;
		}

		api.put(`/posts/${pid}/diffs/${since}`, {}).then(() => {
			modal.modal('hide');
			app.alertSuccess('[[topic:diffs.post-restored]]');
		}).catch(app.alertError);
	};

	return Diffs;
});
