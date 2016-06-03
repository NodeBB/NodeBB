"use strict";
/*global ajaxify, templates, config, RELATIVE_PATH*/

(function(ajaxify) {
	ajaxify.widgets = {};

	ajaxify.widgets.reposition = function(location) {
		$('body [no-widget-class]').each(function() {
			var $this = $(this);
			if ($this.attr('no-widget-target') === location) {
				$this.removeClass();
				$this.addClass($this.attr('no-widget-class'));
			}
		});
	};

	ajaxify.widgets.render = function(template, url, callback) {
		if (template.match(/^admin/)) {
			return callback();
		}

		var widgetLocations = ['sidebar', 'footer', 'header'], numLocations;

		$('#content [widget-area]').each(function() {
			var location = $(this).attr('widget-area');
			if ($.inArray(location, widgetLocations) === -1) {
				widgetLocations.push(location);
			}
		});

		numLocations = widgetLocations.length;

		if (!numLocations) {
			ajaxify.widgets.reposition();
		}

		function renderWidgets(locations) {
			var areaDatas = [];

			$.get(RELATIVE_PATH + '/api/widgets/render' + (config['cache-buster'] ? '?v=' + config['cache-buster'] : ''), {
				locations: locations,
				template: template + '.tpl',
				url: url,
				isMobile: utils.isMobile()
			}, function(renderedAreas) {
				for (var x=0; x<renderedAreas.length; ++x) {
					var renderedWidgets = renderedAreas[x].widgets,
						location = renderedAreas[x].location,
						html = '';

					for (var i=0; i<renderedWidgets.length; ++i) {
						html += templates.parse(renderedWidgets[i].html, {});
					}

					var area = $('#content [widget-area="' + location + '"]');

					if (!area.length && window.location.pathname.indexOf('/admin') === -1 && renderedWidgets.length) {
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
					}

					area.html(html);

					if (!renderedWidgets.length) {
						area.addClass('hidden');
						ajaxify.widgets.reposition(location);
					}
				}

				var widgetAreas = $('#content [widget-area]');
				widgetAreas.find('img:not(.not-responsive)').addClass('img-responsive');
				widgetAreas.find('.timeago').timeago();
				widgetAreas.find('img[title].teaser-pic,img[title].user-img').each(function() {
					$(this).tooltip({
						placement: 'top',
						title: $(this).attr('title')
					});
				});
				$(window).trigger('action:widgets.loaded', {});

				if (typeof callback === 'function') {
					callback();
				}
			});
		}

		renderWidgets(widgetLocations);
	};
}(ajaxify || {}));
