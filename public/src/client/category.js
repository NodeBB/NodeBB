"use strict";
/* global define, config, templates, app, utils, ajaxify, socket */

define('forum/category', [
	'forum/infinitescroll',
	'share',
	'navigator',
	'forum/categoryTools',
	'sort',
	'components',
	'translator',
	'topicSelect',
	'forum/pagination'
], function(infinitescroll, share, navigator, categoryTools, sort, components, translator, topicSelect, pagination) {
	var Category = {};

	$(window).on('action:ajaxify.start', function(ev, data) {
		if (ajaxify.currentPage !== data.url) {
			navigator.disable();

			removeListeners();
		}
	});

	function removeListeners() {
		socket.removeListener('event:new_topic', Category.onNewTopic);
		categoryTools.removeListeners();
	}

	Category.init = function() {
		var	cid = ajaxify.data.cid;

		app.enterRoom('category_' + cid);

		share.addShareHandlers(ajaxify.data.name);

		socket.removeListener('event:new_topic', Category.onNewTopic);
		socket.on('event:new_topic', Category.onNewTopic);

		categoryTools.init(cid);

		sort.handleSort('categoryTopicSort', 'user.setCategorySort', 'category/' + ajaxify.data.slug);

		if (!config.usePagination) {
			navigator.init('[component="category/topic"]', ajaxify.data.topic_count, Category.toTop, Category.toBottom, Category.navigatorCallback);
		}

		enableInfiniteLoadingOrPagination();

		$('[component="category"]').on('click', '[component="topic/header"]', function() {
			var clickedIndex = $(this).parents('[data-index]').attr('data-index');
			$('[component="category/topic"]').each(function(index, el) {
				if ($(el).offset().top - $(window).scrollTop() > 0) {
					localStorage.setItem('category:' + cid + ':bookmark', $(el).attr('data-index'));
					localStorage.setItem('category:' + cid + ':bookmark:clicked', clickedIndex);
					return false;
				}
			});
		});

		handleIgnoreWatch(cid);
	};

	function handleIgnoreWatch(cid) {
		$('.watch, .ignore').on('click', function() {
			var $this = $(this);
			var command = $this.hasClass('watch') ? 'watch' : 'ignore';

			socket.emit('categories.' + command, cid, function(err) {
				if (err) {
					return app.alertError(err.message);
				}

				$('.watch').toggleClass('hidden', command === 'watch');
				$('.ignore').toggleClass('hidden', command === 'ignore');

				app.alertSuccess('[[category:' + command + '.message]]');
			});
		});
	}

	Category.toTop = function() {
		navigator.scrollTop(0);
	};

	Category.toBottom = function() {
		socket.emit('categories.getTopicCount', ajaxify.data.cid, function(err, count) {
			navigator.scrollBottom(count - 1);
		});
	};

	Category.navigatorCallback = function(topIndex, bottomIndex, elementCount) {
		return bottomIndex;
	};

	$(window).on('action:popstate', function(ev, data) {
		if (data.url.startsWith('category/')) {
			var cid = data.url.match(/^category\/(\d+)/);
			if (cid && cid[1]) {
				cid = cid[1];
			}
			if (!cid) {
				return;
			}

			var bookmarkIndex = localStorage.getItem('category:' + cid + ':bookmark');
			var clickedIndex = localStorage.getItem('category:' + cid + ':bookmark:clicked');

			bookmarkIndex = Math.max(0, parseInt(bookmarkIndex, 10) || 0);
			clickedIndex = Math.max(0, parseInt(clickedIndex, 10) || 0);
			if (!parseInt(bookmarkIndex, 10)) {
				return;
			}

			if (config.usePagination) {
				var page = Math.ceil((parseInt(bookmarkIndex, 10) + 1) / config.topicsPerPage);
				if (parseInt(page, 10) !== ajaxify.data.pagination.currentPage) {
					pagination.loadPage(page, function() {
						Category.scrollToTopic(bookmarkIndex, clickedIndex, 400);
					});
				} else {
					Category.scrollToTopic(bookmarkIndex, clickedIndex, 400);
				}
			} else {
				if (bookmarkIndex === 0) {
					Category.highlightTopic(clickedIndex);
					return;
				}

				$('[component="category"]').empty();

				loadTopicsAfter(Math.max(0, bookmarkIndex - 1), 1, function() {
					Category.scrollToTopic(bookmarkIndex, clickedIndex, 0);
				});
			}
		}
	});

	Category.highlightTopic = function(topicIndex) {
		var highlight = components.get('category/topic', 'index', topicIndex);

		if (highlight.length && !highlight.hasClass('highlight')) {
			highlight.addClass('highlight');
			setTimeout(function() {
				highlight.removeClass('highlight');
			}, 5000);
		}
	};

	Category.scrollToTopic = function(bookmarkIndex, clickedIndex, duration, offset) {
		if (!bookmarkIndex) {
			return;
		}

		if (!offset) {
			offset = 0;
		}

		var scrollTo = components.get('category/topic', 'index', bookmarkIndex);
		var	cid = ajaxify.data.cid;

		if (scrollTo.length && cid) {
			$('html, body').animate({
				scrollTop: (scrollTo.offset().top - offset) + 'px'
			}, duration !== undefined ? duration : 400, function() {
				Category.highlightTopic(clickedIndex);
				navigator.update();
			});
		}
	};

	function enableInfiniteLoadingOrPagination() {
		if (!config.usePagination) {
			infinitescroll.init($('[component="category"]'), Category.loadMoreTopics);
		} else {
			navigator.disable();
		}
	}

	Category.onNewTopic = function(topic) {
		var	cid = ajaxify.data.cid;
		if (!topic || parseInt(topic.cid, 10) !== parseInt(cid, 10)) {
			return;
		}

		$(window).trigger('filter:categories.new_topic', topic);

		var editable = !!$('.thread-tools').length;

		templates.parse('category', 'topics', {
			privileges: {editable: editable},
			showSelect: editable,
			topics: [topic]
		}, function(html) {
			translator.translate(html, function(translatedHTML) {
				var topic = $(translatedHTML),
					container = $('[component="category"]'),
					topics = $('[component="category/topic"]'),
					numTopics = topics.length;

				$('[component="category"]').removeClass('hidden');
				$('.category-sidebar').removeClass('hidden');

				var noTopicsWarning = $('#category-no-topics');
				if (noTopicsWarning.length) {
					noTopicsWarning.remove();
					ajaxify.widgets.render('category', window.location.pathname.slice(1));
				}

				if (numTopics > 0) {
					for (var x = 0; x < numTopics; x++) {
						var pinned = $(topics[x]).hasClass('pinned');
						if (pinned) {
							if(x === numTopics - 1) {
								topic.insertAfter(topics[x]);
							}
							continue;
						}
						topic.insertBefore(topics[x]);
						break;
					}
				} else {
					container.append(topic);
				}

				topic.hide().fadeIn('slow');

				topic.find('.timeago').timeago();
				app.createUserTooltips();
				updateTopicCount();

				$(window).trigger('action:categories.new_topic.loaded');
			});
		});
	};

	function updateTopicCount() {
		socket.emit('categories.getTopicCount', ajaxify.data.cid, function(err, topicCount) {
			if(err) {
				return app.alertError(err.message);
			}
			navigator.setCount(topicCount);
		});
	}

	Category.loadMoreTopics = function(direction) {
		if (!$('[component="category"]').length || !$('[component="category"]').children().length) {
			return;
		}

		var topics = $('[component="category/topic"]');
		var afterEl = direction > 0 ? topics.last() : topics.first();
		var after = parseInt(afterEl.attr('data-index'), 10) || 0;

		loadTopicsAfter(after, direction);
	};

	function loadTopicsAfter(after, direction, callback) {
		callback = callback || function() {};
		if (!utils.isNumber(after) || (after === 0 && components.get('category/topic', 'index', 0).length)) {
			return callback();
		}

		$(window).trigger('action:categories.loading');
		infinitescroll.loadMore('categories.loadMore', {
			cid: ajaxify.data.cid,
			after: after,
			direction: direction,
			author: utils.params().author
		}, function (data, done) {
			if (data.topics && data.topics.length) {
				Category.onTopicsLoaded(data, direction, done);
			} else {
				done();
			}

			$(window).trigger('action:categories.loaded');
			callback();
		});
	}


	Category.onTopicsLoaded = function(data, direction, callback) {
		if (!data || !data.topics.length) {
			return callback();
		}

		function removeAlreadyAddedTopics(topics) {
			return topics.filter(function(topic) {
				return components.get('category/topic', 'tid', topic.tid).length === 0;
			});
		}

		data.topics = removeAlreadyAddedTopics(data.topics);
		if (!data.topics.length) {
			return callback();
		}

		data.showSelect = data.privileges.editable;

		var after, before;
		var topics = $('[component="category/topic"]');

		if (direction > 0 && topics.length) {
			after = topics.last();
		} else if (direction < 0 && topics.length) {
			before = topics.first();
		}

		app.parseAndTranslate('category', 'topics', data, function(html) {
			$('[component="category"]').removeClass('hidden');
			$('.category-sidebar').removeClass('hidden');

			$('#category-no-topics').remove();

			if (after) {
				html.insertAfter(after);
			} else if (before) {
				var height = $(document).height(),
				 	scrollTop = $(window).scrollTop();

				html.insertBefore(before);

				$(window).scrollTop(scrollTop + ($(document).height() - height));
			} else {
				$('[component="category"]').append(html);
			}

			if (!topicSelect.getSelectedTids().length) {
				infinitescroll.removeExtra($('[component="category/topic"]'), direction, 60);
			}

			html.find('.timeago').timeago();
			app.createUserTooltips();
			utils.makeNumbersHumanReadable(html.find('.human-readable-number'));

			$(window).trigger('action:topics.loaded', {topics: data.topics});

			callback();
		});
	};

	return Category;
});