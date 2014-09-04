'use strict';

/* globals define, app, socket */

define('forum/topic/move', function() {

	var Move = {},
		modal,
		targetCid,
		targetCategoryLabel;

	Move.init = function(tids, currentCid, onComplete) {
		modal = $('#move_thread_modal');

		Move.tids = tids;
		Move.currentCid = currentCid;
		Move.onComplete = onComplete;
		Move.moveAll = tids ? false : true;

		modal.on('shown.bs.modal', onMoveModalShown);
		$('#move-confirm').hide();

		if (Move.moveAll || (tids && tids.length > 1)) {
			modal.find('.modal-header h3').translateText('[[topic:move_topics]]');
		}

		modal.modal('show');
	};

	function onMoveModalShown() {
		var loadingEl = $('#categories-loading');
		if (!loadingEl.length) {
			return;
		}

		socket.emit('categories.get', onCategoriesLoaded);
	}

	function onCategoriesLoaded(err, categories) {
		if (err) {
			return app.alertError(err.message);
		}

		renderCategories(categories);

		modal.on('click', '.category-list li[data-cid]', function(e) {
			selectCategory($(this));
		});

		$('#move_thread_commit').on('click', onCommitClicked);
	}

	function selectCategory(category) {
		modal.find('#confirm-category-name').html(category.html());
		$('#move-confirm').show();

		targetCid = category.attr('data-cid');
		targetCategoryLabel = category.html();
		$('#move_thread_commit').prop('disabled', false);
	}

	function onCommitClicked() {
		var commitEl = $('#move_thread_commit');

		if (!commitEl.prop('disabled') && targetCid) {
			commitEl.prop('disabled', true);

			moveTopics();
		}
	}

	function moveTopics() {
		socket.emit(Move.moveAll ? 'topics.moveAll' : 'topics.move', {
			tids: Move.tids,
			cid: targetCid,
			currentCid: Move.currentCid
		}, function(err) {
			modal.modal('hide');
			$('#move_thread_commit').prop('disabled', false);

			if(err) {
				return app.alertError(err.message);
			}

			app.alertSuccess('[[topic:topic_move_success, ' + targetCategoryLabel + ']]');
			if (typeof Move.onComplete === 'function') {
				Move.onComplete();
			}
		});
	}

	function renderCategories(categories) {
		templates.parse('partials/category_list', {categories: categories}, function(html) {
			modal.find('.modal-body').prepend(html);
			$('#categories-loading').remove();
		});
	}

	return Move;
});
