"use strict";

var ajaxify = {};

(function () {
	/*global app, templates, utils, socket, translator, config, RELATIVE_PATH*/

	var location = document.location || window.location,
		rootUrl = location.protocol + '//' + (location.hostname || location.host) + (location.port ? ':' + location.port : ''),
		content = null;

	var events = [];
	ajaxify.register_events = function (new_page_events) {
		for (var i = 0, ii = events.length; i < ii; i++) {
			socket.removeAllListeners(events[i]); // optimize this to user removeListener(event, listener) instead.
		}

		events = new_page_events;
	};


	window.onpopstate = function (event) {
		if (event !== null && event.state && event.state.url !== undefined && !ajaxify.initialLoad) {
			ajaxify.go(event.state.url, function() {
				$(window).trigger('action:popstate', {url: event.state.url});
			}, true);
		}
	};

	ajaxify.currentPage = null;
	ajaxify.initialLoad = false;

	ajaxify.go = function (url, callback, quiet) {
		// "quiet": If set to true, will not call pushState
		app.enterRoom('global');

		$(window).off('scroll');

		$(window).trigger('action:ajaxify.start', {url: url});

		if ($('#content').hasClass('ajaxifying')) {
			templates.cancelRequest();
		}

		// Remove trailing slash
		url = url.replace(/\/$/, "");

		if (url.indexOf(RELATIVE_PATH.slice(1)) !== -1) {
			url = url.slice(RELATIVE_PATH.length);
		}
		var tpl_url = ajaxify.getTemplateMapping(url);

		var hash = '';
		if(ajaxify.initialLoad) {
			hash = window.location.hash ? window.location.hash : '';
		}

		if (templates.is_available(tpl_url) && !templates.force_refresh(tpl_url)) {
			ajaxify.currentPage = tpl_url;

			if (window.history && window.history.pushState) {
				window.history[!quiet ? 'pushState' : 'replaceState']({
					url: url + hash
				}, url, RELATIVE_PATH + '/' + url + hash);

				$.ajax(RELATIVE_PATH + '/plugins/fireHook', {
					type: 'PUT',
					data: {
						_csrf: $('#csrf_token').val(),
						hook: 'page.load',
						args: {
							template: tpl_url,
							url: url,
							uid: app.uid
						}
					}
				});
			}

			translator.load(tpl_url);

			ajaxify.fadeOut();

			templates.flush();
			templates.load_template(function () {
				ajaxify.loadScript(tpl_url);

				if (typeof callback === 'function') {
					callback();
				}

				app.processPage();

				ajaxify.renderWidgets(tpl_url, url, function(err) {
					ajaxify.fadeIn();
					ajaxify.initialLoad = false;

					app.refreshTitle(url);
					$(window).trigger('action:ajaxify.end', {url: url});
				});
			}, url);

			return true;
		}

		return false;
	};

	ajaxify.loadScript = function(tpl_url, callback) {
		require(['forum/' + tpl_url], function(script) {
			if (script && script.init) {
				script.init();
			}

			if (callback) {
				callback();
			}
		});
	};

	ajaxify.fadeIn = function() {
		$('#content, #footer').stop(true, true).removeClass('ajaxifying');
	};

	ajaxify.fadeOut = function() {
		$('#footer, #content').removeClass('hide').addClass('ajaxifying');
	};

	ajaxify.getTemplateMapping = function(url) {
		var tpl_url = templates.get_custom_map(url.split('?')[0]);

		if (tpl_url === false && !templates[url]) {
			if (url === '' || url === '/') {
				tpl_url = 'home';
			} else if (url === 'admin' || url === 'admin/') {
				tpl_url = 'admin/index';
			} else {
				tpl_url = url.split('/');

				while(tpl_url.length) {
					if (templates.is_available(tpl_url.join('/'))) {
						tpl_url = tpl_url.join('/');
						break;
					}
					tpl_url.pop();
				}
				
				if (!tpl_url.length) {
					tpl_url = url.split('/')[0].split('?')[0];
				}
			}
		} else if (templates[url]) {
			tpl_url = url;
		}

		return tpl_url;
	};

	ajaxify.renderWidgets = function(tpl_url, url, callback) {
		var widgetLocations = [], numLocations;

		$('#content [widget-area]').each(function() {
			widgetLocations.push($(this).attr('widget-area'));
		});

		numLocations = widgetLocations.length;

		function renderWidgets(location) {
			var area = $('#content [widget-area="' + location + '"]');

			socket.emit('widgets.render', {template: tpl_url + '.tpl', url: url, location: location}, function(err, renderedWidgets) {
				if (area.html()) {
					area.html(templates.prepare(area.html()).parse({
						widgets: renderedWidgets
					})).removeClass('hidden');

					if (!renderedWidgets.length) {
						$('body [no-widget-class]').each(function() {
							var $this = $(this);
							$this.removeClass();
							$this.addClass($this.attr('no-widget-class'));
						});
					}
				}

				checkCallback();
			});
		}

		function checkCallback() {
			numLocations--;
			if (numLocations <= 0 && callback) {
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


	ajaxify.refresh = function() {
		ajaxify.go(ajaxify.currentPage);
	};

	$('document').ready(function () {
		if (!window.history || !window.history.pushState) {
			return; // no ajaxification for old browsers
		}

		content = content || document.getElementById('content');

		// Enhancing all anchors to ajaxify...
		$(document.body).on('click', 'a', function (e) {
			function hrefEmpty(href) {
				return href === 'javascript:;' || href === window.location.href + "#" || href.slice(-1) === "#";
			}

			if (hrefEmpty(this.href) || this.target !== '' || this.protocol === 'javascript:') {
				return;
			}

			if(!window.location.pathname.match(/\/(403|404)$/g)) {
				app.previousUrl = window.location.href;
			}

			if ($(this).attr('data-ajaxify') === 'false') {
				return;
			}

			if ((!e.ctrlKey && !e.shiftKey) && e.which === 1) {
				if (this.host === window.location.host) {
					// Internal link
					var url = this.href.replace(rootUrl + '/', '');

					if (ajaxify.go(url)) {
						e.preventDefault();
					}
				} else if (window.location.pathname !== '/outgoing') {
					// External Link

					if (config.useOutgoingLinksPage) {
						ajaxify.go('outgoing?url=' + encodeURIComponent(this.href));
						e.preventDefault();
					}
				}
			}
		});
	});

}());
