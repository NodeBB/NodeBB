'use strict';


define('forum/topic/move', ['categorySelector', 'alerts'], function (categorySelector, alerts) {
	var Move = {};
	var modal;
	var selectedCategory;

	Move.init = function (tids, currentCid, onComplete) {
		Move.tids = tids;
		Move.currentCid = currentCid;
		Move.onComplete = onComplete;
		Move.moveAll = !tids;

		showModal();
	};

	function showModal() {
		app.parseAndTranslate('partials/move_thread_modal', {}, function (html) {
			modal = html;
			modal.on('hidden.bs.modal', function () {
				modal.remove();
			});

			modal.find('#move-confirm').addClass('hide');

			if (Move.moveAll || (Move.tids && Move.tids.length > 1)) {
				modal.find('.modal-header h3').translateText('[[topic:move_topics]]');
			}

			categorySelector.init(modal.find('[component="category-selector"]'), {
				onSelect: onCategorySelected,
				privilege: 'moderate',
			});

			modal.find('#move_thread_commit').on('click', onCommitClicked);

			modal.modal('show');
		});
	}

	function onCategorySelected(category) {
		selectedCategory = category;
		modal.find('#move_thread_commit').prop('disabled', false);
	}

	function onCommitClicked() {
		var commitEl = modal.find('#move_thread_commit');

		if (!commitEl.prop('disabled') && selectedCategory && selectedCategory.cid) {
			commitEl.prop('disabled', true);

			modal.modal('hide');
			var message = '[[topic:topic_move_success, ' + selectedCategory.name + ']]';
			if (Move.tids && Move.tids.length > 1) {
				message = '[[topic:topic_move_multiple_success, ' + selectedCategory.name + ']]';
			} else if (!Move.tids) {
				message = '[[topic:topic_move_all_success, ' + selectedCategory.name + ']]';
			}
			var data = {
				tids: Move.tids ? Move.tids.slice() : null,
				cid: selectedCategory.cid,
				currentCid: Move.currentCid,
				onComplete: Move.onComplete,
			};
			alerts.alert({
				alert_id: 'tids_move_' + (Move.tids ? Move.tids.join('-') : 'all'),
				title: '[[topic:thread_tools.move]]',
				message: message,
				type: 'success',
				timeout: 10000,
				timeoutfn: function () {
					moveTopics(data);
				},
				clickfn: function (alert, params) {
					delete params.timeoutfn;
					app.alertSuccess('[[topic:topic_move_undone]]');
				},
			});
		}
	}

	function moveTopics(data) {
		$(window).trigger('action:topic.move', data);

		socket.emit(!data.tids ? 'topics.moveAll' : 'topics.move', data, function (err) {
			if (err) {
				return app.alertError(err.message);
			}

			if (typeof data.onComplete === 'function') {
				data.onComplete();
			}
		});
	}

	return Move;
});
