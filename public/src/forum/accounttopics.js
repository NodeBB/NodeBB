'use strict';

/* globals define, app, socket, ajaxify, templates, translator, utils */

define(['forum/accountheader'], function(header) {
	var AccountTopics = {},
		loadingMore = false;

	AccountTopics.init = function() {
		header.init();

		app.enableInfiniteLoading(function() {
			if(!loadingMore) {
				loadMore();
			}
		});
	};

	function loadMore() {
		loadingMore = true;
		socket.emit('topics.loadMoreFromSet', {
			set: 'uid:' + $('.account-username-box').attr('data-uid') + ':topics',
			after: $('.user-topics').attr('data-nextstart')
		}, function(err, data) {
			if(err) {
				return app.alertError(err.message);
			}

			if (data.topics && data.topics.length) {
				onTopicsLoaded(data.topics);
				$('.user-topics').attr('data-nextstart', data.nextStart);
			}

			loadingMore = false;
		});
	}

	function onTopicsLoaded(topics) {
		ajaxify.loadTemplate('accounttopics', function(accounttopics) {
			var html = templates.parse(templates.getBlock(accounttopics, 'topics'), {topics: topics});

			translator.translate(html, function(translatedHTML) {
				html = $(translatedHTML);
				$('#topics-container').append(html);
				html.find('span.timeago').timeago();
				app.createUserTooltips();
				utils.makeNumbersHumanReadable(html.find('.human-readable-number'));
			});
		});
	}

	return AccountTopics;
});
