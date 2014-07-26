'use strict';

/* globals define, app, socket, utils */

define('forum/account/topics', ['forum/account/header', 'forum/infinitescroll'], function(header, infinitescroll) {
	var AccountTopics = {};

	AccountTopics.init = function() {
		header.init();

		infinitescroll.init(loadMore);
	};

	function loadMore(direction) {
		if (direction < 0) {
			return;
		}

		infinitescroll.loadMore('topics.loadMoreFromSet', {
			set: 'uid:' + $('.account-username-box').attr('data-uid') + ':topics',
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
		infinitescroll.parseAndTranslate('account/topics', 'topics', {topics: topics}, function(html) {
			$('#topics-container').append(html);
			html.find('span.timeago').timeago();
			app.createUserTooltips();
			utils.makeNumbersHumanReadable(html.find('.human-readable-number'));
			callback();
		});
	}

	return AccountTopics;
});
