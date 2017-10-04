'use strict';

(function (ajaxify) {
	ajaxify.widgets = {};

	ajaxify.widgets.render = function (template, callback) {
		callback = callback || function () {};

		if (template.match(/^admin/)) {
			return callback();
		}

		var locations = Object.keys(ajaxify.data.widgets);

		locations.forEach(function (location) {
			var area = $('#content [widget-area="' + location + '"]');
			if (area.length) {
				return;
			}

			var widgetsAtLocation = ajaxify.data.widgets[location] || [];
			var html = '';

			widgetsAtLocation.forEach(function (widget) {
				html += widget.html;
			});

			if (location === 'footer' && !$('#content [widget-area="footer"]').length) {
				$('#content').append($('<div class="row"><div widget-area="footer" class="col-xs-12"></div></div>'));
			} else if (location === 'sidebar' && !$('#content [widget-area="sidebar"]').length) {
				if ($('[component="account/cover"]').length) {
					$('[component="account/cover"]').nextAll().wrapAll($('<div class="row"><div class="col-lg-9 col-xs-12"></div><div widget-area="sidebar" class="col-lg-3 col-xs-12"></div></div></div>'));
				} else if ($('[component="groups/cover"]').length) {
					$('[component="groups/cover"]').nextAll().wrapAll($('<div class="row"><div class="col-lg-9 col-xs-12"></div><div widget-area="sidebar" class="col-lg-3 col-xs-12"></div></div></div>'));
				} else {
					$('#content > *').wrapAll($('<div class="row"><div class="col-lg-9 col-xs-12"></div><div widget-area="sidebar" class="col-lg-3 col-xs-12"></div></div></div>'));
				}
			} else if (location === 'header' && !$('#content [widget-area="header"]').length) {
				$('#content').prepend($('<div class="row"><div widget-area="header" class="col-xs-12"></div></div>'));
			}

			area = $('#content [widget-area="' + location + '"]');
			if (html && area.length) {
				area.html(html);
			}

			if (widgetsAtLocation.length) {
				area.removeClass('hidden');
			}
		});

		var widgetAreas = $('#content [widget-area]');
		widgetAreas.find('img:not(.not-responsive)').addClass('img-responsive');
		widgetAreas.find('.timeago').timeago();
		widgetAreas.find('img[title].teaser-pic,img[title].user-img').each(function () {
			$(this).tooltip({
				placement: 'top',
				title: $(this).attr('title'),
			});
		});
		$(window).trigger('action:widgets.loaded', {});
		callback();
	};
}(ajaxify || {}));
