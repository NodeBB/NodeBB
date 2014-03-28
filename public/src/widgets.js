"use strict";
/*global ajaxify, socket, templates*/

(function(ajaxify) {
	ajaxify.widgets = {};
	
	ajaxify.widgets.reposition = function() {
		$('body [no-widget-class]').each(function() {
			var $this = $(this);
			$this.removeClass();
			$this.addClass($this.attr('no-widget-class'));
		});
	};

	ajaxify.widgets.render = function(tpl_url, url, callback) {
		var widgetLocations = [], numLocations;

		$('#content [widget-area]').each(function() {
			widgetLocations.push($(this).attr('widget-area'));
		});

		numLocations = widgetLocations.length;

		if (!numLocations) {
			ajaxify.widgets.reposition();
		}

		function renderWidgets(location) {
			var area = $('#content [widget-area="' + location + '"]');

			socket.emit('widgets.render', {template: tpl_url + '.tpl', url: url, location: location}, function(err, renderedWidgets) {
				var html = '';

				for (var widget in renderedWidgets) {
					if (renderedWidgets.hasOwnProperty(widget)) {
						html += renderedWidgets[widget].html;
					}
				}

				area.html(html).removeClass('hidden');

				if (!renderedWidgets.length) {
					ajaxify.widgets.reposition();
				}

				$('#content [widget-area] img:not(.user-img)').addClass('img-responsive');
				checkCallback();
			});
		}

		function checkCallback() {
			numLocations--;
			if (numLocations < 0 && callback) {
				callback();
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