'use strict';

/* globals define, app, socket */

define(function() {

	var Move = {};

	Move.init = function(tid) {
		var modal = $('#move_thread_modal'),
			targetCid,
			targetCategoryLabel;

		$('.move_thread').on('click', function(e) {
			modal.modal('show');
			return false;
		});

		modal.on('shown.bs.modal', onMoveModalShown);

		function onMoveModalShown() {
			var loadingEl = $('#categories-loading');
			if (!loadingEl.length) {
				return;
			}

			socket.emit('categories.get', onCategoriesLoaded);
		}

		function onCategoriesLoaded(err, data) {
			if (err) {
				return app.alertError(err.message);
			}

			renderCategories(data.categories);

			modal.find('.category-list').on('click', 'li[data-cid]', function(e) {
				selectCategory($(this));
			});

			$('#move_thread_commit').on('click', onCommitClicked);
		}

		function selectCategory(category) {
			modal.find('#confirm-category-name').html(category.html());
			$('#move-confirm').css({display: 'block'});

			targetCid = category.attr('data-cid');
			targetCategoryLabel = category.html();
			$('#move_thread_commit').prop('disabled', false);
		}

		function onCommitClicked() {
			var commitEl = $('#move_thread_commit'),
				cancelEl = $('#move_thread_cancel');

			if (!commitEl.prop('disabled') && targetCid) {
				commitEl.prop('disabled', true);
				cancelEl.fadeOut(250);
				modal.find('.modal-header button').fadeOut(250);
				commitEl.html('Moving <i class="fa-spin fa-refresh"></i>');

				moveTopic();
			}
		}

		function moveTopic() {
			socket.emit('topics.move', {
				tid: tid,
				cid: targetCid
			}, function(err) {
				modal.modal('hide');
				if(err) {
					return app.alertError(err.message);
				}

				app.alertSuccess('[[topic:topic_move_success, ' + targetCategoryLabel + ']]');
			});
		}

		function renderCategories(categories) {
			var categoriesEl = modal.find('.category-list'),
				info;

			for (var x = 0; x < categories.length; ++x) {
				info = categories[x];
				$('<li />')
					.css({background: info.bgColor, color: info.color || '#fff'})
					.addClass(info.disabled === '1' ? ' disabled' : '')
					.attr('data-cid', info.cid)
					.html('<i class="fa ' + info.icon + '"></i> ' + info.name)
					.appendTo(categoriesEl);
			}

			$('#categories-loading').remove();
		}
	};

	return Move;
});
