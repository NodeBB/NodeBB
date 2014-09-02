'use strict';

/* globals define, socket, app, templates, translator, ajaxify*/

define('forum/home', function() {
	var	home = {};

	$(window).on('action:ajaxify.start', function(ev, data) {
		if (data.url !== '') {
			socket.removeListener('event:new_post', home.onNewPost);
		}
	});


	home.init = function() {
		app.enterRoom('home');

		socket.removeListener('event:new_post', home.onNewPost);
		socket.on('event:new_post', home.onNewPost);

		$('.home .category-header').tooltip({
			placement: 'bottom'
		});
	};

	home.onNewPost = function(data) {
		if (data && data.posts && data.posts.length && data.posts[0].topic) {
			renderNewPost(data.posts[0].topic.cid, data.posts[0]);
		}
	};

	function renderNewPost(cid, post) {
		var category = $('.home .category-item[data-cid="' + cid + '"]');
		var categoryBox = category.find('.category-box');
		var numRecentReplies = category.attr('data-numRecentReplies');
		if (!numRecentReplies || !parseInt(numRecentReplies, 10)) {
			return;
		}

		var recentPosts = categoryBox.find('.post-preview');
		var insertBefore = recentPosts.first();

		parseAndTranslate([post], function(html) {
			html.hide();
			if(recentPosts.length === 0) {
				html.appendTo(categoryBox);
			} else {
				html.insertBefore(recentPosts.first());
			}

			html.fadeIn();

			app.createUserTooltips();

			if (categoryBox.find('.post-preview').length > parseInt(numRecentReplies, 10)) {
				recentPosts.last().remove();
			}
		});
	}

	function parseAndTranslate(posts, callback) {
		ajaxify.loadTemplate('home', function(homeTemplate) {
			var html = templates.parse(templates.getBlock(homeTemplate, 'posts'), {categories: {posts: posts}});

			translator.translate(html, function(translatedHTML) {
				translatedHTML = $(translatedHTML);
				translatedHTML.find('img').addClass('img-responsive');
				translatedHTML.find('span.timeago').timeago();
				callback(translatedHTML);
			});
		});
	}

	return home;
});
