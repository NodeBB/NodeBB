'use strict';

/* globals define, app, socket*/

define('forum/popular', ['forum/recent', 'forum/infinitescroll'], function(recent, infinitescroll) {
	var Popular = {};

	Popular.init = function() {
		app.enterRoom('recent_posts');

		$('#new-topics-alert').on('click', function() {
			$(this).addClass('hide');
		});

		selectActivePill();
	};

	function selectActivePill() {
		var active = getActiveSection();

		$('.nav-pills li').removeClass('active');
		$('.nav-pills li a').each(function() {
			var $this = $(this);
			if ($this.attr('href').match(active)) {
				$this.parent().addClass('active');
				return false;
			}
		});
	};

	function getActiveSection() {
		parts = window.location.href.split('/');
		return parts[parts.length - 1];
	}

	return Popular;
});
