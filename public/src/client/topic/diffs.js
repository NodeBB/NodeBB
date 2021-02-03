'use strict';

define('forum/topic/diffs', ['api', 'bootbox', 'forum/topic/images'], function (api, bootbox) {
	const Diffs = {};
	const localeStringOpts = { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric' };

	Diffs.open = function (pid) {
		if (!config.enablePostHistory) {
			return;
		}

		api.get(`/posts/${pid}/diffs`, {}).then((data) => {
			parsePostHistory(data).then(($html) => {
				const $modal = bootbox.dialog({ title: '[[topic:diffs.title]]', message: $html, size: 'large' });

				if (!data.timestamps.length) {
					return;
				}

				const $selectEl = $modal.find('select');
				const $revertEl = $modal.find('button[data-action="restore"]');
				const $deleteEl = $modal.find('button[data-action="delete"]');
				const $postContainer = $modal.find('ul.posts-list');
				const $numberOfDiffCon = $modal.find('.number-of-diffs strong');

				$selectEl.on('change', function () {
					Diffs.load(pid, this.value, $postContainer);
					$revertEl.prop('disabled', data.timestamps.indexOf(this.value) === 0);
					$deleteEl.prop('disabled', data.timestamps.indexOf(this.value) === 0);
				});

				$revertEl.on('click', function () {
					Diffs.restore(pid, $selectEl.val(), $modal);
				});

				$deleteEl.on('click', function () {
					Diffs.delete(pid, $selectEl.val(), $selectEl, $numberOfDiffCon);
				});

				$modal.on('shown.bs.modal', function () {
					Diffs.load(pid, $selectEl.val(), $postContainer);
					$revertEl.prop('disabled', true);
					$deleteEl.prop('disabled', true);
				});
			});
		}).catch(app.alertError);
	};

	Diffs.load = function (pid, since, $postContainer) {
		if (!config.enablePostHistory) {
			return;
		}

		api.get(`/posts/${pid}/diffs/${since}`, {}).then((data) => {
			data.deleted = !!parseInt(data.deleted, 10);

			app.parseAndTranslate('partials/posts_list', 'posts', {
				posts: [data],
			}, function ($html) {
				$postContainer.empty().append($html);
			});
		}).catch(app.alertError);
	};

	Diffs.restore = function (pid, since, $modal) {
		if (!config.enablePostHistory) {
			return;
		}

		api.put(`/posts/${pid}/diffs/${since}`, {}).then(() => {
			$modal.modal('hide');
			app.alertSuccess('[[topic:diffs.post-restored]]');
		}).catch(app.alertError);
	};

	Diffs.delete = function (pid, timestamp, $selectEl, $numberOfDiffCon) {
		api.del(`/posts/${pid}/diffs/${timestamp}`).then((data) => {
			parsePostHistory(data, 'diffs').then(($html) => {
				$selectEl.empty().append($html);
				$selectEl.trigger('change');
				const numberOfDiffs = $selectEl.find('option').length;
				$numberOfDiffCon.text(numberOfDiffs);
				app.alertSuccess('[[topic:diffs.deleted]]');
			});
		}).catch(app.alertError);
	};

	function parsePostHistory(data, blockName) {
		return new Promise((resolve) => {
			const params = [{
				diffs: data.revisions.map(function (revision) {
					const timestamp = parseInt(revision.timestamp, 10);

					return {
						username: revision.username,
						timestamp: timestamp,
						pretty: new Date(timestamp).toLocaleString(config.userLang.replace('_', '-'), localeStringOpts),
					};
				}),
				numDiffs: data.timestamps.length,
				editable: data.editable,
				deletable: data.deletable,
			}, function ($html) {
				resolve($html);
			}];

			if (blockName) {
				params.unshift(blockName);
			}

			app.parseAndTranslate('partials/modals/post_history', ...params);
		});
	}

	return Diffs;
});
