'use strict';

/* globals define, app, socket, templates, translator */

define('forum/topic/move', function() {

	var Move = {},
		modal,
		targetCid,
		targetCategoryLabel;

	Move.init = function(tids, currentCid, onComplete) {
		Move.tids = tids;
		Move.currentCid = currentCid;
		Move.onComplete = onComplete;
		Move.moveAll = tids ? false : true;

		socket.emit('categories.get', onCategoriesLoaded);
	};

	function onCategoriesLoaded(err, categories) {
		if (err) {
			return app.alertError(err.message);
		}

		parseModal(categories, function(html) {
			modal = $(html);

			modal.on('hidden.bs.modal', function() {
				modal.remove();
			});

			modal.find('#move-confirm').addClass('hide');

			if (Move.moveAll || (Move.tids && Move.tids.length > 1)) {
				modal.find('.modal-header h3').translateText('[[topic:move_topics]]');
			}

			modal.on('click', '.category-list li[data-cid]', function(e) {
				selectCategory($(this));
			});

			modal.find('#move_thread_commit').on('click', onCommitClicked);

			modal.modal('show');
		});
	}

	function parseModal(categories, callback) {
		templates.parse('partials/move_thread_modal', {categories: categories}, function(html) {
			translator.translate(html, callback);
		});
	}

	function selectCategory(category) {
		modal.find('#confirm-category-name').html(category.html());
		modal.find('#move-confirm').removeClass('hide');

		targetCid = category.attr('data-cid');
		targetCategoryLabel = category.html();
		modal.find('#move_thread_commit').prop('disabled', false);
	}

	function onCommitClicked() {
		var commitEl = modal.find('#move_thread_commit');

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

			if (err) {
				return app.alertError(err.message);
			}

			app.alertSuccess('[[topic:topic_move_success, ' + targetCategoryLabel + ']]');
			if (typeof Move.onComplete === 'function') {
				Move.onComplete();
			}
		});
	}


	return Move;
});
