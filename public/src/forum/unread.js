define(['forum/recent'], function(recent) {
	var Unread = {},
		loadingMoreTopics = false;

	Unread.init = function() {
		app.enterRoom('recent_posts');

		$('#new-topics-alert').on('click', function() {
			$(this).addClass('hide');
		});

		recent.watchForNewPosts();

		$('#mark-allread-btn').on('click', function() {
			function getUnreadTids() {
				var tids = [];
				$('#topics-container .category-item[data-tid]').each(function() {
					tids.push($(this).attr('data-tid'));
				});
				return tids;
			}

			var btn = $(this);

			socket.emit('topics.markAllRead', getUnreadTids(), function(err) {
				if(err) {
					return app.alertError('There was an error marking topics read!');
				}

				btn.remove();
				$('#topics-container').empty();
				$('#category-no-topics').removeClass('hidden');
				app.alertSuccess('All topics marked as read!');
				$('#numUnreadBadge')
					.removeClass('badge-important')
					.addClass('badge-inverse')
					.html('0');
			});
		});

		if ($("body").height() <= $(window).height() && $('#topics-container').children().length >= 20) {
			$('#load-more-btn').show();
		}

		$('#load-more-btn').on('click', function() {
			loadMoreTopics();
		});

		app.enableInfiniteLoading(function() {
			if(!loadingMoreTopics) {
				loadMoreTopics();
			}
		});

		function loadMoreTopics() {
			if(!$('#topics-container').length) {
				return;
			}

			loadingMoreTopics = true;
			socket.emit('topics.loadMoreUnreadTopics', {
				after: $('#topics-container').attr('data-nextstart')
			}, function(err, data) {
				if(err) {
					return app.alertError(err.message);
				}

				if (data.topics && data.topics.length) {
					recent.onTopicsLoaded('unread', data.topics);
					$('#topics-container').attr('data-nextstart', data.nextStart);
				} else {
					$('#load-more-btn').hide();
				}

				loadingMoreTopics = false;
			});
		}
	};

	return Unread;
});