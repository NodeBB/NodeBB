'use strict';

(function (ajaxify) {
	ajaxify.widgets = {};

	ajaxify.widgets.render = function (template) {
		if (template.match(/^admin/)) {
			return;
		}

		var locations = Object.keys(ajaxify.data.widgets);

		locations.forEach(function (location) {
			var area = $('#content [widget-area="' + location + '"],#content [data-widget-area="' + location + '"]').eq(0);
			if (area.length) {
				return;
			}

			var widgetsAtLocation = ajaxify.data.widgets[location] || [];
			var html = '';

			widgetsAtLocation.forEach(function (widget) {
				html += widget.html;
			});

			if (location === 'footer' && !$('#content [widget-area="footer"],#content [data-widget-area="footer"]').length) {
				$('#content').append($('<div class="row"><div data-widget-area="footer" class="col-xs-12"></div></div>'));
			} else if (location === 'sidebar' && !$('#content [widget-area="sidebar"],#content [data-widget-area="sidebar"]').length) {
				if ($('[component="account/cover"]').length) {
					$('[component="account/cover"]').nextAll().wrapAll($('<div class="row"><div class="col-lg-9 col-xs-12"></div><div data-widget-area="sidebar" class="col-lg-3 col-xs-12"></div></div></div>'));
				} else if ($('[component="groups/cover"]').length) {
					$('[component="groups/cover"]').nextAll().wrapAll($('<div class="row"><div class="col-lg-9 col-xs-12"></div><div data-widget-area="sidebar" class="col-lg-3 col-xs-12"></div></div></div>'));
				} else {
					$('#content > *').wrapAll($('<div class="row"><div class="col-lg-9 col-xs-12"></div><div data-widget-area="sidebar" class="col-lg-3 col-xs-12"></div></div></div>'));
				}
			} else if (location === 'header' && !$('#content [widget-area="header"],#content [data-widget-area="header"]').length) {
				$('#content').prepend($('<div class="row"><div data-widget-area="header" class="col-xs-12"></div></div>'));
			}

			area = $('#content [widget-area="' + location + '"],#content [data-widget-area="' + location + '"]').eq(0);
			if (html && area.length) {
				area.html(html);
				area.find('img:not(.not-responsive)').addClass('img-responsive');
			}

			if (widgetsAtLocation.length) {
				area.removeClass('hidden');
			}
		});

		$(window).trigger('action:widgets.loaded', {});
	};
}(ajaxify || {}));
