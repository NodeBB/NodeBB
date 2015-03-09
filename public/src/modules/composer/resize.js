
'use strict';

/* globals app, define, config, utils*/

define('composer/resize', function() {
	var resize = {},
		oldPercentage = 0,
		env;

	resize.reposition = function(postContainer) {
		var	percentage = localStorage.getItem('composer:resizePercentage');

		doResize(postContainer, percentage);
	};

	function doResize(postContainer, percentage) {
		if (!env) {
			env = utils.findBootstrapEnvironment();
		}

		postContainer.percentage = percentage;

		if (percentage) {
			if (percentage < 0.35) {
				// write snap to taskbar code
			}

			if (env === 'md' || env === 'lg') {
				postContainer.css('transform', 'translate(0, ' + (Math.abs(1-percentage) * 100) + '%)');
			}
		}

		// todo, lump in browsers that don't support transform (ie8) here
		// at this point we should use modernizr
		if (env === 'sm' || env === 'xs' || window.innerHeight < 480) {
			app.toggleNavbar(false);
			//postContainer.css('height', $(window).height());
		}

		if (config.hasImageUploadPlugin) {
			postContainer.find('.img-upload-btn').removeClass('hide');
			postContainer.find('#files.lt-ie9').removeClass('hide');
		}

		if (config.allowFileUploads) {
			postContainer.find('.file-upload-btn').removeClass('hide');
			postContainer.find('#files.lt-ie9').removeClass('hide');
		}

		postContainer.css('visibility', 'visible');

		// Add some extra space at the bottom of the body so that the user can still scroll to the last post w/ composer open
		$('body').css({'margin-bottom': postContainer.css('height')});

		resizeWritePreview(postContainer);
	}

	resize.handleResize = function(postContainer) {
		function resizeStart(e) {
			var resizeRect = resizeEl[0].getBoundingClientRect(),
				resizeCenterY = resizeRect.top + (resizeRect.height/2);
				
			resizeOffset = resizeCenterY - e.clientY;
			resizeActive = true;
			resizeDown = e.clientY;

			$(window).on('mousemove', resizeAction);
			$(window).on('mouseup', resizeStop);
			$('body').on('touchmove', resizeTouchAction);
		}

		function resizeStop(e) {
			resizeActive = false;

			postContainer.find('textarea').focus();
			$(window).off('mousemove', resizeAction);
			$(window).off('mouseup', resizeStop);
			$('body').off('touchmove', resizeTouchAction);

			var position = (e.clientY + resizeOffset),
				newHeight = $(window).height() - position,
				windowHeight = $(window).height();

			if (newHeight > windowHeight - $('#header-menu').height() - (windowHeight / 15)) {
				snapToTop = true;
			} else {
				snapToTop = false;
			}

			toggleMaximize(e);
		}

		function toggleMaximize(e) {
			if (e.clientY - resizeDown === 0 || snapToTop) {
				var newPercentage = ($(window).height() - $('#header-menu').height()) / $(window).height();

				if (!postContainer.hasClass('maximized') || !snapToTop) {
					oldPercentage = postContainer.percentage;
					doResize(postContainer, newPercentage);
					postContainer.addClass('maximized');
				} else {
					doResize(postContainer, oldPercentage);
					postContainer.removeClass('maximized');
				}
			}
		}

		function resizeTouchAction(e) {
			e.preventDefault();
			resizeAction(e.touches[0]);
		}

		function resizeAction(e) {
			if (resizeActive) {
				var position = (e.clientY + resizeOffset),
					newHeight = $(window).height() - position;

				doResize(postContainer, newHeight / $(window).height());

				resizeWritePreview(postContainer);
				resizeSavePosition(newHeight);

				if (Math.abs(e.clientY - resizeDown) > 0) {
					postContainer.removeClass('maximized');
				}
			}

			e.preventDefault();
			return false;
		}

		function resizeSavePosition(px) {
			var	percentage = px / $(window).height();
			localStorage.setItem('composer:resizePercentage', percentage);
		}

		var	resizeActive = false,
			resizeOffset = 0,
            resizeDown = 0,
            snapToTop = false,
			resizeEl = postContainer.find('.resizer');

		resizeEl.on('mousedown', resizeStart);

		resizeEl.on('touchstart', function(e) {
			e.preventDefault();
			resizeStart(e.touches[0]);
		});

		resizeEl.on('touchend', function(e) {
			e.preventDefault();
			resizeStop();
		});
	};


	function resizeWritePreview(postContainer) {
		var total = getFormattingHeight(postContainer);
		postContainer.find('.write-preview-container').css('height', postContainer.percentage * $(window).height() - $('#header-menu').height() - total);
	}

	function getFormattingHeight(postContainer) {
		return [
			postContainer.find('.title-container').outerHeight(true),
			postContainer.find('.formatting-bar').outerHeight(true),
			postContainer.find('.topic-thumb-container').outerHeight(true),
			$('.taskbar').height()
		].reduce(function(a, b) {
			return a + b;
		});
	}


	return resize;
});
