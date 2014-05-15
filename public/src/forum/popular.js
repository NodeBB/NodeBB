define(['forum/recent'], function(recent) {
	var Popular = {},
		loadingMoreTopics = false,
		active = '';

	Popular.init = function() {
		app.enterRoom('recent_posts');

		$('#new-topics-alert').on('click', function() {
			$(this).addClass('hide');
		});

		recent.watchForNewPosts();

		active = recent.selectActivePill();

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
			socket.emit('topics.loadMoreFromSet', {
				set: 'topics:' + $('.nav-pills .active a').html().toLowerCase(),
				after: $('#topics-container').attr('data-nextstart')
			}, function(err, data) {
				if(err) {
					return app.alertError(err.message);
				}

				if (data.topics && data.topics.length) {
					recent.onTopicsLoaded('popular', data.topics, false);
					$('#topics-container').attr('data-nextstart', data.nextStart);
				} else {
					$('#load-more-btn').hide();
				}

				loadingMoreTopics = false;
			});
		}
	};

	return Popular;
});
