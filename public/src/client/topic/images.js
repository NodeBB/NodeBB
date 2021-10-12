'use strict';


define('forum/topic/images', [], function () {
	const Images = {};

	Images.wrapImagesInLinks = function (posts) {
		posts.find('[component="post/content"] img:not(.emoji)').each(function () {
			const $this = $(this);
			let src = $this.attr('src') || '';
			const alt = $this.attr('alt') || '';
			const suffixRegex = /-resized(\.[\w]+)?$/;

			if (src === 'about:blank') {
				return;
			}

			if (utils.isRelativeUrl(src) && suffixRegex.test(src)) {
				src = src.replace(suffixRegex, '$1');
			}
			const srcExt = src.split('.').slice(1).pop();
			const altFilename = alt.split('/').pop();
			const altExt = altFilename.split('.').slice(1).pop();

			if (!$this.parent().is('a')) {
				$this.wrap('<a href="' + src + '" ' +
					(!srcExt && altExt ? ' download="' + altFilename + '" ' : '') +
					' target="_blank" rel="noopener">');
			}
		});
	};

	return Images;
});
