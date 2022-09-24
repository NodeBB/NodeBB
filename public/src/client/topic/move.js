'use strict';


define('forum/topic/move', [
	'categorySelector', 'alerts', 'hooks',
], function (categorySelector, alerts, hooks) {
	const Move = {};
	let modal;
	let selectedCategory;

	Move.init = function (tids, currentCid, onComplete) {
		if (modal) {
			return;
		}
		Move.tids = tids;
		Move.currentCid = currentCid;
		Move.onComplete = onComplete;
		Move.moveAll = !tids;

		showModal();
	};

	function showModal() {
		app.parseAndTranslate('modals/move-topic', {}, function (html) {
			modal = html;
			$('body').append(modal);

			if (Move.moveAll || (Move.tids && Move.tids.length > 1)) {
				modal.find('.card-header').translateText('[[topic:move_topics]]');
			}

			categorySelector.init(modal.find('[component="category-selector"]'), {
				onSelect: onCategorySelected,
				privilege: 'moderate',
			});

			modal.find('#move_thread_commit').on('click', onCommitClicked);
			modal.find('#move_topic_cancel').on('click', closeMoveModal);
		});
	}

	function onCategorySelected(category) {
		selectedCategory = category;
		modal.find('#move_thread_commit').prop('disabled', false);
	}

	function onCommitClicked() {
		const commitEl = modal.find('#move_thread_commit');

		if (!commitEl.prop('disabled') && selectedCategory && selectedCategory.cid) {
			commitEl.prop('disabled', true);
			closeMoveModal();
			let message = '[[topic:topic_move_success, ' + selectedCategory.name + ']]';
			if (Move.tids && Move.tids.length > 1) {
				message = '[[topic:topic_move_multiple_success, ' + selectedCategory.name + ']]';
			} else if (!Move.tids) {
				message = '[[topic:topic_move_all_success, ' + selectedCategory.name + ']]';
			}
			const data = {
				tids: Move.tids ? Move.tids.slice() : null,
				cid: selectedCategory.cid,
				currentCid: Move.currentCid,
				onComplete: Move.onComplete,
			};
			if (config.undoTimeout > 0) {
				return alerts.alert({
					alert_id: 'tids_move_' + (Move.tids ? Move.tids.join('-') : 'all'),
					title: '[[topic:thread_tools.move]]',
					message: message,
					type: 'success',
					timeout: config.undoTimeout,
					timeoutfn: function () {
						moveTopics(data);
					},
					clickfn: function (alert, params) {
						delete params.timeoutfn;
						alerts.success('[[topic:topic_move_undone]]');
					},
				});
			}

			moveTopics(data);
		}
	}

	function moveTopics(data) {
		hooks.fire('action:topic.move', data);

		socket.emit(!data.tids ? 'topics.moveAll' : 'topics.move', data, function (err) {
			if (err) {
				return alerts.error(err);
			}

			if (typeof data.onComplete === 'function') {
				data.onComplete();
			}
		});
	}

	function closeMoveModal() {
		if (modal) {
			modal.remove();
			modal = null;
		}
	}

	return Move;
});
