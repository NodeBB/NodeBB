'use strict';


define('forum/topic/images', [], function () {
	const Images = {};
	const suffixRegex = /-resized(\.[\w]+)?$/;

	Images.wrapImagesInLinks = function (posts) {
		posts.find('[component="post/content"] img:not(.emoji)').each(function () {
			const $this = $(this);
			let src = $this.attr('src') || '';
			if (src === 'about:blank') {
				return;
			}

			if (!$this.parent().is('a')) {
				if (utils.isRelativeUrl(src) && suffixRegex.test(src)) {
					src = src.replace(suffixRegex, '$1');
				}
				const alt = $this.attr('alt') || '';
				const srcExt = src.split('.').slice(1).pop();
				const altFilename = alt.split('/').pop();
				const altExt = altFilename.split('.').slice(1).pop();
				$this.wrap('<a href="' + src + '" ' +
					(!srcExt && altExt ? ' download="' + utils.escapeHTML(altFilename) + '" ' : '') +
					' target="_blank" rel="noopener">');
			}
		});
	};

	return Images;
});
