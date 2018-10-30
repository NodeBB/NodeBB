'use strict';


define('forum/tags', ['forum/infinitescroll'], function (infinitescroll) {
	var Tags = {};
	var timeoutId = 0;

	Tags.init = function () {
		app.enterRoom('tags');
		$('#tag-search').focus();
		$('#tag-search').on('input propertychange', function () {
			if (timeoutId) {
				clearTimeout(timeoutId);
				timeoutId = 0;
			}

			if (!$('#tag-search').val().length) {
				return resetSearch();
			}

			timeoutId = setTimeout(function () {
				socket.emit('topics.searchAndLoadTags', { query: $('#tag-search').val() }, function (err, results) {
					if (err) {
						return app.alertError(err.message);
					}
					onTagsLoaded(results.tags, true, function () {
						timeoutId = 0;
					});
				});
			}, 100);
		});

		infinitescroll.init(Tags.loadMoreTags);
	};

	Tags.loadMoreTags = function (direction) {
		if (direction < 0 || !$('.tag-list').length || $('#tag-search').val()) {
			return;
		}

		infinitescroll.loadMore('topics.loadMoreTags', {
			after: $('.tag-list').attr('data-nextstart'),
		}, function (data, done) {
			if (data && data.tags && data.tags.length) {
				onTagsLoaded(data.tags, false, done);
				$('.tag-list').attr('data-nextstart', data.nextStart);
			} else {
				done();
			}
		});
	};

	function resetSearch() {
		socket.emit('topics.loadMoreTags', {
			after: 0,
		}, function (err, data) {
			if (err) {
				return app.alertError(err.message);
			}
			onTagsLoaded(data.tags, true);
		});
	}

	function onTagsLoaded(tags, replace, callback) {
		callback = callback || function () {};
		app.parseAndTranslate('tags', 'tags', { tags: tags }, function (html) {
			$('.tag-list')[replace ? 'html' : 'append'](html);
			utils.makeNumbersHumanReadable(html.find('.human-readable-number'));
			callback();
		});
	}

	return Tags;
});
