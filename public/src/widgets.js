'use strict';

module.exports.render = function (template) {
	if (template.match(/^admin/)) {
		return;
	}

	const locations = Object.keys(ajaxify.data.widgets);

	locations.forEach(function (location) {
		let area = $('#content [widget-area="' + location + '"],#content [data-widget-area="' + location + '"]').eq(0);
		const widgetsAtLocation = ajaxify.data.widgets[location] || [];
		if (area.length || !widgetsAtLocation.length) {
			return;
		}

		const html = widgetsAtLocation.map(widget => widget.html).join('');
		if (!html) {
			return;
		}
		if (location === 'footer' && !$('#content [widget-area="footer"],#content [data-widget-area="footer"]').length) {
			$('#content').append($('<div data-widget-area="footer"></div>'));
		} else if (location === 'sidebar' && !$('#content [widget-area="sidebar"],#content [data-widget-area="sidebar"]').length) {
			if ($('[component="account/cover"]').length) {
				$('[component="account/cover"]').nextAll().wrapAll($('<div class="row"><div class="col-lg-9 col-12"></div><div data-widget-area="sidebar" class="col-lg-3 col-12"></div></div></div>'));
			} else if ($('[component="groups/cover"]').length) {
				$('[component="groups/cover"]').nextAll().wrapAll($('<div class="row"><div class="col-lg-9 col-12"></div><div data-widget-area="sidebar" class="col-lg-3 col-12"></div></div></div>'));
			} else {
				$('#content > *').wrapAll($('<div class="row"><div class="col-lg-9 col-12"></div><div data-widget-area="sidebar" class="col-lg-3 col-12"></div></div></div>'));
			}
		} else if (location === 'header' && !$('#content [widget-area="header"],#content [data-widget-area="header"]').length) {
			$('#content').prepend($('<div class="row"><div data-widget-area="header" class="col-12"></div></div>'));
		}

		area = $('#content [widget-area="' + location + '"],#content [data-widget-area="' + location + '"]').eq(0);
		if (html && area.length) {
			area.html(html);
			area.find('img:not(.not-responsive)').addClass('img-fluid');
		}

		if (widgetsAtLocation.length) {
			area.removeClass('hidden');
		}
	});

	require(['hooks'], function (hooks) {
		hooks.fire('action:widgets.loaded', {});
	});
};

