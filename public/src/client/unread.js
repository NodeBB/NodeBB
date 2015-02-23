'use strict';

/* globals define, app, socket */

define('forum/unread', ['forum/recent', 'topicSelect', 'forum/infinitescroll'], function(recent, topicSelect, infinitescroll) {
	var Unread = {};

	$(window).on('action:ajaxify.start', function(ev, data) {
		if (data.tpl_url !== 'unread') {
			recent.removeListeners();
		}
	});

	Unread.init = function() {
		var topicsContainer = $('#topics-container');

		app.enterRoom('recent_posts');

		$('#new-topics-alert').on('click', function() {
			$(this).addClass('hide');
		});

		recent.watchForNewPosts();

		$('#markSelectedRead').on('click', function() {
			var tids = topicSelect.getSelectedTids();
			if(!tids.length) {
				return;
			}
			socket.emit('topics.markAsRead', tids, function(err) {
				if(err) {
					return app.alertError(err.message);
				}

				doneRemovingTids(tids);
			});
		});

		$('#markAllRead').on('click', function() {
			socket.emit('topics.markAllRead', function(err) {
				if(err) {
					return app.alertError(err.message);
				}

				app.alertSuccess('[[unread:topics_marked_as_read.success]]');

				topicsContainer.empty();
				$('#category-no-topics').removeClass('hidden');
				$('.markread').addClass('hidden');
			});
		});

		$('.markread').on('click', '.category', function() {
			function getCategoryTids(cid) {
				var tids = [];
				$('#topics-container .category-item[data-cid="' + cid + '"]').each(function() {
					tids.push($(this).attr('data-tid'));
				});
				return tids;
			}
			var cid = $(this).attr('data-cid');
			var tids = getCategoryTids(cid);

			socket.emit('topics.markCategoryTopicsRead', cid, function(err) {
				if(err) {
					return app.alertError(err.message);
				}

				doneRemovingTids(tids);
			});
		});

		topicsContainer.on('click', '.topic-title, .replies a', function(e) {
			var tid = $(e.target).parents('[data-tid]').attr('data-tid');
			socket.emit('topics.markAsRead', [tid], function(err) {
				if(err) {
					return app.alertError(err.message);
				}

				doneRemovingTids([tid]);
			});
		});

		socket.emit('categories.get', onCategoriesLoaded);

		topicSelect.init();

		if ($("body").height() <= $(window).height() && topicsContainer.children().length >= 20) {
			$('#load-more-btn').show();
		}

		$('#load-more-btn').on('click', function() {
			loadMoreTopics();
		});

		infinitescroll.init(loadMoreTopics);

		function loadMoreTopics(direction) {
			if(direction < 0 || !topicsContainer.length) {
				return;
			}

			infinitescroll.loadMore('topics.loadMoreUnreadTopics', {
				after: topicsContainer.attr('data-nextstart')
			}, function(data, done) {
				if (data.topics && data.topics.length) {
					recent.onTopicsLoaded('unread', data.topics, true, done);
					topicsContainer.attr('data-nextstart', data.nextStart);
				} else {
					done();
					$('#load-more-btn').hide();
				}
			});
		}
	};

	function doneRemovingTids(tids, quiet) {
		removeTids(tids);

		if (!quiet) { app.alertSuccess('[[unread:topics_marked_as_read.success]]'); }

		if (!$('#topics-container').children().length) {
			$('#category-no-topics').removeClass('hidden');
			$('.markread').addClass('hidden');
		}
	}

	function removeTids(tids) {
		for(var i=0; i<tids.length; ++i) {
			$('#topics-container .category-item[data-tid="' + tids[i] + '"]').remove();
		}
	}

	function onCategoriesLoaded(err, categories) {
		createCategoryLinks(categories);
	}

	function createCategoryLinks(categories) {
		for (var i=0; i<categories.length; ++i) {
			createCategoryLink(categories[i]);
		}
	}

	function createCategoryLink(category) {
		var link = $('<a role="menuitem" href="#"></a>');
		
		if (category.icon) {
			link.append('<i class="fa fa-fw ' + category.icon + '"></i> ' + category.name);
		} else {
			link.append(category.name);
		}

		$('<li role="presentation" class="category" data-cid="' + category.cid + '"></li>')
			.append(link)
			.appendTo($('.markread .dropdown-menu'));
	}

	return Unread;
});
