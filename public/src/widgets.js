"use strict";
/*global ajaxify, socket, templates*/

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

	ajaxify.widgets.render = function(tpl_url, url, callback) {
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

		function renderWidgets(location) {
			// remove when https://code.google.com/p/chromium/issues/detail?id=357625 is fixed
			try {
				var temp = localStorage.getItem('cache:widgets:' + url + ':' + location);
			} catch (e) {
				var temp = null;
			}

			var area = $('#content [widget-area="' + location + '"]')
				.html(temp);


			socket.emit('widgets.render', {template: tpl_url + '.tpl', url: url, location: location}, function(err, renderedWidgets) {
				var html = '';

				for (var widget in renderedWidgets) {
					if (renderedWidgets.hasOwnProperty(widget)) {
						html += templates.parse(renderedWidgets[widget].html, {});
					}
				}

				if (!area.length && window.location.pathname.indexOf('/admin') === -1 && renderedWidgets.length) {
					if (location === 'footer') {
						$('#content').append($('<div class="col-xs-12"><div widget-area="footer"></div></div>'));
					} else if (location === 'sidebar') {
						$('#content > *').wrapAll($('<div class="col-lg-9 col-xs-12"></div>'));
						$('#content').append($('<div class="col-lg-3 col-xs-12"><div widget-area="sidebar"></div></div>'));
					} else if (location === 'header') {
						$('#content').prepend($('<div class="col-xs-12"><div widget-area="header"></div></div>'));
					}

					area = $('#content [widget-area="' + location + '"]');
				}

				area.html(html);
				// remove when https://code.google.com/p/chromium/issues/detail?id=357625 is fixed
				try {
					localStorage.setItem('cache:widgets:' + url + ':' + location, html);
				} catch (e) {}
				
				if (!renderedWidgets.length) {
					area.addClass('hidden');
					ajaxify.widgets.reposition(location);
				}

				$('#content [widget-area] img:not(.user-img)').addClass('img-responsive');
				checkCallback();
			});
		}

		function checkCallback() {
			numLocations--;
			if (numLocations < 0) {
				$(window).trigger('action:widgets.loaded', {});
				if (typeof callback === 'function') {
					callback();
				}
			}
		}

		for (var i in widgetLocations) {
			if (widgetLocations.hasOwnProperty(i)) {
				renderWidgets(widgetLocations[i]);
			}
		}

		checkCallback();
	};
}(ajaxify || {}));
