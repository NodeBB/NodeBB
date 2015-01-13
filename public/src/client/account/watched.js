'use strict';

/* globals define, app, socket, utils */
define('forum/account/watched', ['forum/account/header', 'forum/infinitescroll'], function(header, infinitescroll) {
	var AccountWatched = {};

	AccountWatched.init = function() {
		header.init();

		infinitescroll.init(loadMore);
	};

	function loadMore(direction) {
		console.log(direction);
		if (direction < 0) {
			return;
		}

		infinitescroll.loadMore('topics.loadMoreFromSet', {
			set: 'uid:' + $('.account-username-box').attr('data-uid') + ':followed_tids',
			after: $('.user-topics').attr('data-nextstart')
		}, function(data, done) {
			if (data.topics && data.topics.length) {
				onTopicsLoaded(data.topics, done);
				$('.user-topics').attr('data-nextstart', data.nextStart);
			} else {
				done();
			}
		});
	}

	function onTopicsLoaded(topics, callback) {
		infinitescroll.parseAndTranslate('account/watched', 'topics', {topics: topics}, function(html) {
			$('#topics-container').append(html);
			html.find('span.timeago').timeago();
			app.createUserTooltips();
			utils.makeNumbersHumanReadable(html.find('.human-readable-number'));
			$(window).trigger('action:topics.loaded');
			callback();
		});
	}

	return AccountWatched;
});
