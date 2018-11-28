'use strict';


define('forum/topic/images', [], function () {
	var Images = {};

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
				$this.wrap('<a href="' + src + '" ' +
					(!srcExt && altExt ? ' download="' + altFilename + '" ' : '') +
					' target="_blank" >');
			}
		});
	};

	return Images;
});
