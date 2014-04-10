'use strict';

/* globals define, app, socket */

define(['forum/recent'], function(recent) {
	var Unread = {},
		loadingMoreTopics = false;

	Unread.init = function() {
		app.enterRoom('recent_posts');

		$('#new-topics-alert').on('click', function() {
			$(this).addClass('hide');
		});

		recent.watchForNewPosts();

		$('#markSelectedRead').on('click', function() {
			function getSelectedTids() {
				var tids = [];
				$('#topics-container .category-item.selected').each(function() {
					tids.push($(this).attr('data-tid'));
				});
				return tids;
			}
			var tids = getSelectedTids();
			if(!tids.length) {
				return;
			}
			socket.emit('topics.markTidsRead', tids, function(err) {
				if(err) {
					return app.alertError('There was an error marking topics read!');
				}

				doneRemovingTids(tids);
			});
		});

		$('#markAllRead').on('click', function() {
			socket.emit('topics.markAllRead', function(err) {
				if(err) {
					return app.alertError('There was an error marking topics read!');
				}

				app.alertSuccess('[[unread:topics_marked_as_read.success]]');

				$('#topics-container').empty();
				$('#category-no-topics').removeClass('hidden');
				$('.markread').addClass('hidden');

				$('#numUnreadBadge')
					.removeClass('badge-important')
					.addClass('badge-inverse')
					.html('0');
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
					return app.alertError('There was an error marking topics read!');
				}

				doneRemovingTids(tids);
			});
		});

		socket.emit('categories.get', onCategoriesLoaded);

		$('#topics-container').on('click', '.select', function() {
			var select = $(this);
			var isChecked = !select.hasClass('fa-square-o');

			select.toggleClass('fa-check-square-o', !isChecked);
			select.toggleClass('fa-square-o', isChecked);
			select.parents('.category-item').toggleClass('selected', !isChecked);
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
					recent.onTopicsLoaded('unread', data.topics, true);
					$('#topics-container').attr('data-nextstart', data.nextStart);
				} else {
					$('#load-more-btn').hide();
				}

				loadingMoreTopics = false;
			});
		}
	};

	function doneRemovingTids(tids) {
		removeTids(tids);

		app.alertSuccess('[[unread:topics_marked_as_read.success]]');

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

	function onCategoriesLoaded(err, data) {
		createCategoryLinks(data.categories);
	}

	function createCategoryLinks(categories) {
		categories = categories.filter(function(category) {
			return !category.disabled;
		});

		for(var i=0; i<categories.length; ++i) {
			createCategoryLink(categories[i]);
		}
	}

	function createCategoryLink(category) {
		var link = $('<li role="presentation" class="category" data-cid="' + category.cid + '"><a role="menuitem" href="#"><i class="fa fa-fw ' + category.icon + '"></i> ' + category.name + '</a></li>');

		$('.markread .dropdown-menu').append(link);
	}

	return Unread;
});
