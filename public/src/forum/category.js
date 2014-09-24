"use strict";
/* global define, config, templates, app, utils, ajaxify, socket, translator */

define('forum/category', ['composer', 'forum/pagination', 'forum/infinitescroll', 'share', 'navigator', 'forum/categoryTools'], function(composer, pagination, infinitescroll, share, navigator, categoryTools) {
	var Category = {};

	$(window).on('action:ajaxify.start', function(ev, data) {
		if(data && data.url.indexOf('category') !== 0) {
			navigator.hide();

			removeListeners();
		}
	});

	function removeListeners() {
		socket.removeListener('event:new_topic', Category.onNewTopic);
		categoryTools.removeListeners();
	}

	Category.init = function() {
		var	cid = ajaxify.variables.get('category_id');

		app.enterRoom('category_' + cid);

		share.addShareHandlers(ajaxify.variables.get('category_name'));

		$('#new_post').on('click', function () {
			composer.newTopic(cid);
		});

		socket.on('event:new_topic', Category.onNewTopic);

		categoryTools.init(cid);

		enableInfiniteLoadingOrPagination();

		if (!config.usePagination) {
			navigator.init('#topics-container > .category-item', ajaxify.variables.get('topic_count'), Category.toTop, Category.toBottom, Category.navigatorCallback);
		}

		$('#topics-container').on('click', '.topic-title', function() {
			var clickedTid = $(this).parents('li.category-item[data-tid]').attr('data-tid');
			$('#topics-container li.category-item').each(function(index, el) {
				if($(el).offset().top - $(window).scrollTop() > 0) {
					localStorage.setItem('category:' + cid + ':bookmark', $(el).attr('data-tid'));
					localStorage.setItem('category:' + cid + ':bookmark:clicked', clickedTid);
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
			});
		});
	}

	Category.toTop = function() {
		navigator.scrollTop(0);
	};

	Category.toBottom = function() {
		socket.emit('categories.lastTopicIndex', ajaxify.variables.get('category_id'), function(err, index) {
			navigator.scrollBottom(index);
		});
	};

	Category.navigatorCallback = function(element, elementCount) {
		return parseInt(element.attr('data-index'), 10) + 1;
	};

	$(window).on('action:popstate', function(ev, data) {
		if(data.url.indexOf('category/') === 0) {
			var cid = data.url.match(/^category\/(\d+)/);
			if (cid && cid[1]) {
				cid = cid[1];
			}
			if (!cid) {
				return;
			}

			var bookmark = localStorage.getItem('category:' + cid + ':bookmark');
			var clicked = localStorage.getItem('category:' + cid + ':bookmark:clicked');

			if (!bookmark) {
				return;
			}

			if(config.usePagination) {
				socket.emit('topics.getTidPage', bookmark, function(err, page) {
					if (err) {
						return;
					}
					if(parseInt(page, 10) !== pagination.currentPage) {
						pagination.loadPage(page);
					} else {
						Category.scrollToTopic(bookmark, clicked, 400);
					}
				});
			} else {
				socket.emit('topics.getTidIndex', bookmark, function(err, index) {
					if (err) {
						return;
					}

					if (index === 0) {
						Category.highlightTopic(clicked);
						return;
					}

					if (index < 0) {
						index = 0;
					}

					$('#topics-container').empty();

					loadTopicsAfter(index, function() {
						Category.scrollToTopic(bookmark, clicked, 0);
					});
				});
			}
		}
	});

	Category.highlightTopic = function(tid) {
		var highlight = $('#topics-container li.category-item[data-tid="' + tid + '"]');
		if(highlight.length && !highlight.hasClass('highlight')) {
			highlight.addClass('highlight');
			setTimeout(function() {
				highlight.removeClass('highlight');
			}, 5000);
		}
	};

	Category.scrollToTopic = function(tid, clickedTid, duration, offset) {
		if(!tid) {
			return;
		}

		if(!offset) {
			offset = 0;
		}

		if($('#topics-container li.category-item[data-tid="' + tid + '"]').length) {
			var	cid = ajaxify.variables.get('category_id');
			var scrollTo = $('#topics-container li.category-item[data-tid="' + tid + '"]');

			if (cid && scrollTo.length) {
				$('html, body').animate({
					scrollTop: (scrollTo.offset().top - $('#header-menu').height() - offset) + 'px'
				}, duration !== undefined ? duration : 400, function() {
					Category.highlightTopic(clickedTid);
					navigator.update();
				});
			}
		}
	};

	function enableInfiniteLoadingOrPagination() {
		if (!config.usePagination) {
			infinitescroll.init(Category.loadMoreTopics);
		} else {
			navigator.hide();
			pagination.init(ajaxify.variables.get('currentPage'), ajaxify.variables.get('pageCount'));
		}
	}

	Category.onNewTopic = function(topic) {
		$(window).trigger('filter:categories.new_topic', topic);

		ajaxify.loadTemplate('category', function(categoryTemplate) {
			var html = templates.parse(templates.getBlock(categoryTemplate, 'topics'), {
				privileges: {editable: !!$('.thread-tools').length},
				topics: [topic]
			});

			translator.translate(html, function(translatedHTML) {
				var topic = $(translatedHTML),
					container = $('#topics-container'),
					topics = $('#topics-container').children('.category-item'),
					numTopics = topics.length;

				$('#topics-container, .category-sidebar').removeClass('hidden');

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

				socket.emit('categories.getPageCount', ajaxify.variables.get('category_id'), function(err, newPageCount) {
					pagination.recreatePaginationLinks(newPageCount);
				});

				topic.find('span.timeago').timeago();
				app.createUserTooltips();
				updateTopicCount();

				$(window).trigger('action:categories.new_topic.loaded');
			});
		});
	};

	function updateTopicCount() {
		socket.emit('categories.getTopicCount', ajaxify.variables.get('category_id'), function(err, topicCount) {
			if(err) {
				return app.alertError(err.message);
			}
			navigator.setCount(topicCount);
		});
	}

	Category.onTopicsLoaded = function(data, callback) {
		if(!data || !data.topics.length) {
			return;
		}

		function removeAlreadyAddedTopics(topics) {
			return topics.filter(function(topic) {
				return $('#topics-container li[data-tid="' + topic.tid +'"]').length === 0;
			});
		}

		var after = null,
			before = null;

		function findInsertionPoint() {
			if (!$('#topics-container .category-item[data-tid]').length) {
				return;
			}
			var last = $('#topics-container .category-item[data-tid]').last();
			var lastIndex = last.attr('data-index');
			var firstIndex = data.topics[data.topics.length - 1].index;
			if (firstIndex > lastIndex) {
				after = last;
			} else {
				before = $('#topics-container .category-item[data-tid]').first();
			}
		}

		data.topics = removeAlreadyAddedTopics(data.topics);
		if(!data.topics.length) {
			return;
		}

		findInsertionPoint();

		ajaxify.loadTemplate('category', function(categoryTemplate) {
			var html = templates.parse(templates.getBlock(categoryTemplate, 'topics'), data);

			translator.translate(html, function(translatedHTML) {
				var container = $('#topics-container'),
					html = $(translatedHTML);

				$('#topics-container, .category-sidebar').removeClass('hidden');
				$('#category-no-topics').remove();

				if(config.usePagination) {
					container.empty().append(html);
				} else {
					if(after) {
						html.insertAfter(after);
					} else if(before) {
						html.insertBefore(before);
					} else {
						container.append(html);
					}
				}

				if (typeof callback === 'function') {
					callback();
				}
				html.find('span.timeago').timeago();
				app.createUserTooltips();
				utils.makeNumbersHumanReadable(html.find('.human-readable-number'));
			});
		});
	};

	Category.loadMoreTopics = function(direction) {
		if (!$('#topics-container').length || !$('#topics-container').children().length) {
			return;
		}

		infinitescroll.calculateAfter(direction, '#topics-container .category-item[data-tid]', config.topicsPerPage, false, function(after, offset, el) {
			loadTopicsAfter(after, function() {
				if (direction < 0 && el) {
					Category.scrollToTopic(el.attr('data-tid'), null, 0, offset);
				}
			});
		});
	};

	function loadTopicsAfter(after, callback) {
		if(!utils.isNumber(after) || (after === 0 && $('#topics-container li.category-item[data-index="0"]').length)) {
			return;
		}

		$(window).trigger('action:categories.loading');
		infinitescroll.loadMore('categories.loadMore', {
			cid: ajaxify.variables.get('category_id'),
			after: after
		}, function (data, done) {

			if (data.topics && data.topics.length) {
				Category.onTopicsLoaded(data, function() {
					done();
					callback();
				});
				$('#topics-container').attr('data-nextstart', data.nextStart);
			} else {
				done();
			}

			$(window).trigger('action:categories.loaded');
		});
	}

	return Category;
});
