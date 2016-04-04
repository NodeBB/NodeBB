'use strict';

/* globals define, app, socket, templates, translator */

define('forum/topic/move', function() {

	var Move = {},
		modal,
		selectedEl;

	Move.init = function(tids, currentCid, onComplete) {
		Move.tids = tids;
		Move.currentCid = currentCid;
		Move.onComplete = onComplete;
		Move.moveAll = tids ? false : true;

		socket.emit('categories.getMoveCategories', onCategoriesLoaded);
	};

	function onCategoriesLoaded(err, categories) {
		if (err) {
			return app.alertError(err.message);
		}

		parseModal(categories, function() {

			modal.on('hidden.bs.modal', function() {
				modal.remove();
			});

			modal.find('#move-confirm').addClass('hide');

			if (Move.moveAll || (Move.tids && Move.tids.length > 1)) {
				modal.find('.modal-header h3').translateText('[[topic:move_topics]]');
			}

			modal.on('click', '.category-list li[data-cid]', function() {
				selectCategory($(this));
			});

			modal.find('#move_thread_commit').on('click', onCommitClicked);

			modal.modal('show');
		});
	}

	function parseModal(categories, callback) {
		templates.parse('partials/move_thread_modal', {categories: []}, function(html) {
			translator.translate(html, function(html) {
				modal = $(html);
				categories.forEach(function(category) {
					if (!category.link) {
						buildRecursive(modal.find('.category-list'), category, '');
					}
				});
				callback();
			});
		});
	}

	function buildRecursive(parentEl, category, level) {
		var categoryEl = $('<li/>');

		if (category.bgColor) {
			categoryEl.css('background-color', category.bgColor);
		}
		if (category.color) {
			categoryEl.css('color', category.color);
		}
		categoryEl.toggleClass('disabled', !!category.disabled);
		categoryEl.attr('data-cid', category.cid);
		categoryEl.attr('data-icon', category.icon);
		categoryEl.attr('data-name', category.name);
		categoryEl.html('<i class="fa fa-fw ' + category.icon + '"></i> ' + category.name);

		parentEl.append(level);
		parentEl.append(categoryEl);
		parentEl.append('<br/>');

		var indent = '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;';
		category.children.forEach(function(childCategory) {
			if (!childCategory.link) {
				buildRecursive(parentEl, childCategory, indent + level);
			}
		});
	}

	function selectCategory(category) {
		modal.find('#confirm-category-name').html(category.html());
		modal.find('#move-confirm').removeClass('hide');

		selectedEl = category;
		modal.find('#move_thread_commit').prop('disabled', false);
	}

	function onCommitClicked() {
		var commitEl = modal.find('#move_thread_commit');

		if (!commitEl.prop('disabled') && selectedEl.attr('data-cid')) {
			commitEl.prop('disabled', true);

			moveTopics();
		}
	}

	function moveTopics() {
		socket.emit(Move.moveAll ? 'topics.moveAll' : 'topics.move', {
			tids: Move.tids,
			cid: selectedEl.attr('data-cid'),
			currentCid: Move.currentCid
		}, function(err) {
			modal.modal('hide');

			if (err) {
				return app.alertError(err.message);
			}

			app.alertSuccess('[[topic:topic_move_success, ' + selectedEl.attr('data-name') + ']] <i class="fa fa-fw ' + selectedEl.attr('data-icon') + '"></i>');
			if (typeof Move.onComplete === 'function') {
				Move.onComplete();
			}
		});
	}


	return Move;
});
