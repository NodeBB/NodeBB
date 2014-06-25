
'use strict';

/* globals define, utils, config */

define('forum/topic/scrollTo', ['forum/topic/pagination', 'navigator'], function(pagination, navigator) {

	var ScrollTo = {};
	ScrollTo.active = false;

	ScrollTo.scrollToPost = function(postIndex, highlight, duration, offset) {
		if (!utils.isNumber(postIndex)) {
			return;
		}

		offset = offset || 0;
		duration = duration !== undefined ? duration : 400;
		scrollTo.active = true;

		if($('#post_anchor_' + postIndex).length) {
			return scrollToPid(postIndex, highlight, duration, offset);
		}

		if(config.usePagination) {
			if (window.location.search.indexOf('page') !== -1) {
				navigator.update();
				scrollTo.active = false;
				return;
			}

			var page = Math.ceil((postIndex + 1) / config.postsPerPage);

			if(parseInt(page, 10) !== pagination.currentPage) {
				pagination.loadPage(page, function() {
					scrollToPid(postIndex, highlight, duration, offset);
				});
			} else {
				scrollToPid(postIndex, highlight, duration, offset);
			}
		}
	};

	function scrollToPid(postIndex, highlight, duration, offset) {
		var scrollTo = $('#post_anchor_' + postIndex);

		function animateScroll() {
			$('html, body').animate({
				scrollTop: (scrollTo.offset().top - $('#header-menu').height() - offset) + 'px'
			}, duration, function() {
				scrollTo.active = false;
				navigator.update();
				highlightPost();
				$('body').scrollTop($('body').scrollTop() - 1);
				$('html').scrollTop($('html').scrollTop() - 1);
			});
		}

		function highlightPost() {
			if (highlight) {
				scrollTo.parent().find('.topic-item').addClass('highlight');
				setTimeout(function() {
					scrollTo.parent().find('.topic-item').removeClass('highlight');
				}, 5000);
			}
		}

		if ($('#post-container').length && scrollTo.length) {
			if($('#post-container li.post-row[data-index="' + postIndex + '"]').attr('data-index') !== '0') {
				animateScroll();
			} else {
				navigator.update();
				highlightPost();
			}
		}
	}

	return ScrollTo;
});