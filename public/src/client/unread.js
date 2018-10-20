'use strict';


define('forum/unread', ['forum/recent', 'topicSelect', 'forum/infinitescroll', 'components'], function (recent, topicSelect, infinitescroll, components) {
	var Unread = {};

	$(window).on('action:ajaxify.start', function (ev, data) {
		if (ajaxify.currentPage !== data.url) {
			recent.removeListeners();
		}
	});

	Unread.init = function () {
		app.enterRoom('unread_topics');

		$('#new-topics-alert').on('click', function () {
			$(this).addClass('hide');
		});

		recent.watchForNewPosts();

		recent.handleCategorySelection();

		$(window).trigger('action:topics.loaded', { topics: ajaxify.data.topics });

		$('#markSelectedRead').on('click', function () {
			var tids = topicSelect.getSelectedTids();
			if (!tids.length) {
				return;
			}
			socket.emit('topics.markAsRead', tids, function (err) {
				if (err) {
					return app.alertError(err.message);
				}

				doneRemovingTids(tids);
			});
		});

		$('#markAllRead').on('click', function () {
			socket.emit('topics.markAllRead', function (err) {
				if (err) {
					return app.alertError(err.message);
				}

				app.alertSuccess('[[unread:topics_marked_as_read.success]]');

				$('[component="category"]').empty();
				$('[component="pagination"]').addClass('hidden');
				$('#category-no-topics').removeClass('hidden');
				$('.markread').addClass('hidden');
			});
		});

		$('.markread').on('click', '.category', function () {
			function getCategoryTids(cid) {
				var tids = [];
				components.get('category/topic', 'cid', cid).each(function () {
					tids.push($(this).attr('data-tid'));
				});
				return tids;
			}
			var cid = $(this).attr('data-cid');
			var tids = getCategoryTids(cid);

			socket.emit('topics.markCategoryTopicsRead', cid, function (err) {
				if (err) {
					return app.alertError(err.message);
				}

				doneRemovingTids(tids);
			});
		});

		topicSelect.init();

		if ($('body').height() <= $(window).height() && $('[component="category"]').children().length >= 20) {
			$('#load-more-btn').show();
		}

		$('#load-more-btn').on('click', function () {
			loadMoreTopics();
		});

		if (!config.usePagination) {
			infinitescroll.init(loadMoreTopics);
		}

		function loadMoreTopics(direction) {
			if (direction < 0 || !$('[component="category"]').length) {
				return;
			}

			infinitescroll.loadMore('topics.loadMoreUnreadTopics', {
				after: $('[component="category"]').attr('data-nextstart'),
				count: config.topicsPerPage,
				cid: utils.params().cid,
				filter: ajaxify.data.selectedFilter.filter,
			}, function (data, done) {
				if (data.topics && data.topics.length) {
					recent.onTopicsLoaded('unread', data.topics, true, direction, done);
					$('[component="category"]').attr('data-nextstart', data.nextStart);
				} else {
					done();
					$('#load-more-btn').hide();
				}
			});
		}
	};

	function doneRemovingTids(tids) {
		removeTids(tids);

		app.alertSuccess('[[unread:topics_marked_as_read.success]]');

		if (!$('[component="category"]').children().length) {
			$('#category-no-topics').removeClass('hidden');
			$('.markread').addClass('hidden');
		}
	}

	function removeTids(tids) {
		for (var i = 0; i < tids.length; i += 1) {
			components.get('category/topic', 'tid', tids[i]).remove();
		}
	}


	return Unread;
});
