'use strict';

/* globals define, socket, app, templates, translator, ajaxify*/

define('forum/categories', ['components'], function(components) {
	var	categories = {};

	$(window).on('action:ajaxify.start', function(ev, data) {
		if (ajaxify.currentPage !== data.url) {
			socket.removeListener('event:new_post', categories.onNewPost);
		}
	});

	categories.init = function() {
		app.enterRoom('categories');

		socket.removeListener('event:new_post', categories.onNewPost);
		socket.on('event:new_post', categories.onNewPost);

		$('.category-header').tooltip({
			placement: 'bottom'
		});
	};

	categories.onNewPost = function(data) {
		if (data && data.posts && data.posts.length && data.posts[0].topic) {
			renderNewPost(data.posts[0].topic.cid, data.posts[0]);
		}
	};

	function renderNewPost(cid, post) {
		var category = components.get('category/topic', 'cid', cid);
		if (!category.length) {
			return;
		}
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

			$(window).trigger('action:posts.loaded', {posts: [post]});
		});
	}

	function parseAndTranslate(posts, callback) {
		templates.parse('categories', 'posts', {categories: {posts: posts}}, function(html) {
			translator.translate(html, function(translatedHTML) {
				translatedHTML = $(translatedHTML);
				translatedHTML.find('img').addClass('img-responsive');
				translatedHTML.find('.timeago').timeago();
				callback(translatedHTML);
			});
		});
	}

	return categories;
});
