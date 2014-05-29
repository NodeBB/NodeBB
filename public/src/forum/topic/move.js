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

		if (tids.length > 1) {
			translator.translate('[[topic:move_topics]]', function(translated) {
				modal.find('.modal-header h3').text(translated);
			});
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

		modal.find('.category-list').on('click', 'li[data-cid]', function(e) {
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
		var categoriesEl = modal.find('.category-list'),
			info;

		for (var x = 0; x < categories.length; ++x) {
			info = categories[x];
			if(parseInt(info.cid, 10) === parseInt(Move.currentCid, 10)) {
				continue;
			}

			$('<li />')
				.css({background: info.bgColor, color: info.color || '#fff'})
				.toggleClass('disabled', info.disabled)
				.attr('data-cid', info.cid)
				.html('<i class="fa ' + info.icon + '"></i> ' + info.name)
				.appendTo(categoriesEl);
		}

		$('#categories-loading').remove();
	}

	return Move;
});
