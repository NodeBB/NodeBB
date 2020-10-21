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

		socket.emit('categories.getMoveCategories', onCategoriesLoaded);
	};

	function onCategoriesLoaded(err, categories) {
		if (err) {
			return app.alertError(err.message);
		}

		app.parseAndTranslate('partials/move_thread_modal', {
			categories: categories,
		}, function (html) {
			modal = $(html);
			modal.on('hidden.bs.modal', function () {
				modal.remove();
			});

			modal.find('#move-confirm').addClass('hide');

			if (Move.moveAll || (Move.tids && Move.tids.length > 1)) {
				modal.find('.modal-header h3').translateText('[[topic:move_topics]]');
			}

			categorySelector.init(modal.find('[component="category-selector"]'), onCategorySelected);

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
			alerts.alert({
				alert_id: 'tids_move_' + (Move.tids ? Move.tids.join('-') : 'all'),
				title: '[[topic:thread_tools.move]]',
				message: message,
				type: 'success',
				timeout: 10000,
				timeoutfn: function () {
					moveTopics();
				},
				clickfn: function (alert, params) {
					delete params.timeoutfn;
					app.alertSuccess('[[topic:topic_move_undone]]');
				},
			});
		}
	}

	function moveTopics() {
		var data = {
			tids: Move.tids,
			cid: selectedCategory.cid,
			currentCid: Move.currentCid,
		};

		$(window).trigger('action:topic.move', data);

		socket.emit(Move.moveAll ? 'topics.moveAll' : 'topics.move', data, function (err) {
			if (err) {
				return app.alertError(err.message);
			}

			if (typeof Move.onComplete === 'function') {
				Move.onComplete();
			}
		});
	}


	return Move;
});
