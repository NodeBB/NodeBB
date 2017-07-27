'use strict';


define('forum/topic/images', [
	'forum/topic/postTools',
	'navigator',
	'components',
], function (postTools, navigator, components) {
	var Images = {
		_imageLoaderTimeout: undefined,
	};

	Images.unloadImages = function (posts) {
		var images = posts.find('[component="post/content"] img:not(.not-responsive)');

		if (config.delayImageLoading) {
			images.each(function () {
				$(this).attr('data-src', $(this).attr('src'));
			}).attr('data-state', 'unloaded').attr('src', 'about:blank');
		} else {
			images.attr('data-state', 'loaded');
			Images.wrapImagesInLinks(posts);
			$(window).trigger('action:images.loaded');
		}
	};

	Images.loadImages = function (threshold) {
		if (Images._imageLoaderTimeout) {
			clearTimeout(Images._imageLoaderTimeout);
		}

		if (!config.delayImageLoading) {
			return;
		}

		Images._imageLoaderTimeout = setTimeout(function () {
			/*
				If threshold is defined, images loaded above this threshold will modify
				the user's scroll position so they are not scrolled away from content
				they were reading. Images loaded below this threshold will push down content.

				If no threshold is defined, loaded images will push down content, as per
				default
			*/

			var images = components.get('post/content').find('img[data-state="unloaded"]');
			var visible = images.filter(function () {
				return utils.isElementInViewport(this);
			});
			var posts = $.unique(visible.map(function () {
				return $(this).parents('[component="post"]').get(0);
			}));
			var scrollTop = $(window).scrollTop();
			var adjusting = false;
			var adjustQueue = [];
			var oldHeight;
			var newHeight;

			function adjustPosition() {
				adjusting = true;
				oldHeight = document.body.clientHeight;

				// Display the image
				$(this).attr('data-state', 'loaded');
				newHeight = document.body.clientHeight;

				var imageRect = this.getBoundingClientRect();
				if (imageRect.top < threshold) {
					scrollTop += newHeight - oldHeight;
					$(window).scrollTop(scrollTop);
				}

				if (adjustQueue.length) {
					adjustQueue.pop()();
				} else {
					adjusting = false;

					Images.wrapImagesInLinks(posts);
					$(window).trigger('action:images.loaded');
					posts.length = 0;
				}
			}

			// For each image, reset the source and adjust scrollTop when loaded
			visible.attr('data-state', 'loading');
			visible.each(function (index, image) {
				image = $(image);

				image.on('load', function () {
					if (!adjusting) {
						adjustPosition.call(this);
					} else {
						adjustQueue.push(adjustPosition.bind(this));
					}
				});

				image.attr('src', image.attr('data-src'));
				image.removeAttr('data-src');
			});
		}, 250);
	};

	Images.wrapImagesInLinks = function (posts) {
		posts.find('[component="post/content"] img:not(.emoji)').each(function () {
			var $this = $(this);
			var src = $this.attr('src') || '';
			var alt = $this.attr('alt') || '';
			var suffixRegex = /-resized(\.[\w]+)?$/;

			if (src === 'about:blank') {
				return;
			}

			if (utils.isRelativeUrl(src) && suffixRegex.test(src)) {
				src = src.replace(suffixRegex, '$1');
			}
			var srcExt = src.split('.').slice(1).pop();
			var altFilename = alt.split('/').pop();
			var altExt = altFilename.split('.').slice(1).pop();

			if (!$this.parent().is('a')) {
				$this.wrap('<a href="' + src + '" '
					+ (!srcExt && altExt ? ' download="' + altFilename + '" ' : '')
					+ ' target="_blank" >');
			}
		});
	};


	return Images;
});
