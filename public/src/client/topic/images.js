'use strict';


define('forum/topic/images', [], function () {
	const Images = {};

	const suffixRegex = /-resized(\.[\w]+)?$/;

	Images.wrapImagesInLinks = function (posts) {
		posts.find('[component="post/content"] img:not(.emoji)').each(function () {
			Images.wrapImageInLink($(this));
		});
	};

	Images.wrapImageInLink = function (imageEl) {
		let src = imageEl.attr('src') || '';
		if (src === 'about:blank') {
			return;
		}

		if (!imageEl.parent().is('a')) {
			if (utils.isRelativeUrl(src) && suffixRegex.test(src)) {
				src = src.replace(suffixRegex, '$1');
			}
			const alt = imageEl.attr('alt') || '';
			const srcExt = src.split('.').slice(1).pop();
			const altFilename = alt.split('/').pop();
			const altExt = altFilename.split('.').slice(1).pop();
			const wrapperLink = $(`<a target="_blank" rel="noopener"></a>`).attr('href', src);
			if (!srcExt && altExt) {
				wrapperLink.attr('download', altFilename);
			}
			imageEl.wrap(wrapperLink);
		}
	};

	return Images;
});
