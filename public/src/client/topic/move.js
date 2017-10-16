'use strict';


define('forum/topic/move', ['categorySelector'], function (categorySelector) {
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

		parseModal(categories, function () {
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

	function parseModal(categories, callback) {
		app.parseAndTranslate('partials/move_thread_modal', { categories: categories }, function (html) {
			modal = $(html);

			callback();
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

			moveTopics();
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
			modal.modal('hide');

			if (err) {
				return app.alertError(err.message);
			}

			app.alertSuccess('[[topic:topic_move_success, ' + selectedCategory.name + ']]');
			if (typeof Move.onComplete === 'function') {
				Move.onComplete();
			}
		});
	}


	return Move;
});
