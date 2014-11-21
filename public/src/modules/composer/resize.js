
'use strict';

/* globals define, config, utils*/

define('composer/resize', function() {
	var resize = {};
	var env = utils.findBootstrapEnvironment();
	var oldPercentage = 0;

	resize.reposition = function(postContainer) {
		var	percentage = localStorage.getItem('composer:resizePercentage');

		doResize(postContainer, percentage);
	};

	function doResize(postContainer, percentage) {
		if (percentage) {
			if (env === 'md' || env === 'lg') {
				postContainer.css('height', Math.floor($(window).height() * percentage) + 'px');
			}
		}

		if (env === 'sm' || env === 'xs') {
			app.toggleNavbar(false);
			postContainer.css('height', $(window).height());
		}

		if (config.hasImageUploadPlugin) {
			postContainer.find('.img-upload-btn').removeClass('hide');
			postContainer.find('#files.lt-ie9').removeClass('hide');
		}

		if (config.allowFileUploads) {
			postContainer.find('.file-upload-btn').removeClass('hide');
			postContainer.find('#files.lt-ie9').removeClass('hide');
		}

		postContainer.css('visibility', 'visible').css('z-index', 2);

		$('body').css({'margin-bottom': postContainer.css('height')});

		resizeWritePreview(postContainer);
	}

	resize.handleResize = function(postContainer) {
		function resizeStart(e) {
			var resizeRect = resizeEl[0].getBoundingClientRect();
			var resizeCenterY = resizeRect.top + (resizeRect.height/2);
			resizeOffset = resizeCenterY - e.clientY;
			resizeActive = true;
			resizeDown = e.clientY;

			$(window).on('mousemove', resizeAction);
			$(window).on('mouseup', resizeStop);
			$('body').on('touchmove', resizeTouchAction);
		}

		function resizeStop(e) {
			resizeActive = false;
			toggleHeight(e);

			postContainer.find('textarea').focus();
			$(window).off('mousemove', resizeAction);
			$(window).off('mouseup', resizeStop);
			$('body').off('touchmove', resizeTouchAction);
		}

		function toggleHeight(e) {
			var triggerIconEl = $('.resizer i');
			if (e.clientY - resizeDown === 0){
				var newPercentage = ($(window).height() - $('#header-menu').height() - 20) / $(window).height();

				if (triggerIconEl.hasClass('fa-chevron-up')) {
					oldPercentage = getPercentage(postContainer);
					doResize(postContainer, newPercentage);
					triggerIconEl.addClass('fa-chevron-down').removeClass('fa-chevron-up');
				} else {
					doResize(postContainer, oldPercentage);
					triggerIconEl.addClass('fa-chevron-up').removeClass('fa-chevron-down');
				}
			} else {
				triggerIconEl.addClass('fa-chevron-up').removeClass('fa-chevron-down');
			}
		}

		function resizeTouchAction(e) {
			e.preventDefault();
			resizeAction(e.touches[0]);
		}

		function resizeAction(e) {
			if (resizeActive) {
				var position = (e.clientY + resizeOffset);
				var newHeight = $(window).height() - position;

				if(newHeight > $(window).height() - $('#header-menu').height() - 20) {
					newHeight = $(window).height() - $('#header-menu').height() - 20;
				} else if (newHeight < 100) {
					newHeight = 100;
				}

				postContainer.css('height', newHeight);
				$('body').css({'margin-bottom': newHeight});
				resizeWritePreview(postContainer);
				resizeSavePosition(newHeight);
			}
			e.preventDefault();
			return false;
		}

		function resizeSavePosition(px) {
			var	percentage = px / $(window).height();
			localStorage.setItem('composer:resizePercentage', percentage);
		}

		function getPercentage(postContainer) {
			return postContainer.height() / $(window).height();
		}

		var	resizeActive = false,
			resizeOffset = 0,
            resizeDown = 0,
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
		var h1 = postContainer.find('.title-container').outerHeight(true);
		var h2 = postContainer.find('.category-tag-row').outerHeight(true);
		var h3 = postContainer.find('.formatting-bar').outerHeight(true);
		var h4 = postContainer.find('.topic-thumb-container').outerHeight(true);
		var h5 = $('.taskbar').height();
		var total = h1 + h2 + h3 + h4 + h5;
		postContainer.find('.write-preview-container').css('height', postContainer.height() - total);
	}


	return resize;
});
