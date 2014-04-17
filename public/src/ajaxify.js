"use strict";

var ajaxify = ajaxify || {};

(function () {
	/*global app, templates, utils, socket, translator, config, RELATIVE_PATH*/

	var location = document.location || window.location,
		rootUrl = location.protocol + '//' + (location.hostname || location.host) + (location.port ? ':' + location.port : ''),
		templatesConfig = null,
		availableTemplates = null,
		apiXHR = null;

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

		if ($('#content').hasClass('ajaxifying') && apiXHR) {
			apiXHR.abort();
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

		if (ajaxify.isTemplateAvailable(tpl_url) && !!!templatesConfig.force_refresh[tpl_url]) {
			ajaxify.currentPage = tpl_url;

			if (window.history && window.history.pushState) {
				window.history[!quiet ? 'pushState' : 'replaceState']({
					url: url + hash
				}, url, RELATIVE_PATH + '/' + url + hash);
			}

			translator.load(tpl_url);

			$('#footer, #content').removeClass('hide').addClass('ajaxifying');

			ajaxify.variables.flush();
			ajaxify.loadData(function () {
				ajaxify.loadScript(tpl_url);

				if (typeof callback === 'function') {
					callback();
				}

				app.processPage();

				ajaxify.widgets.render(tpl_url, url, function(err) {
					$('#content, #footer').stop(true, true).removeClass('ajaxifying');
					ajaxify.initialLoad = false;

					app.refreshTitle(url);
					$(window).trigger('action:ajaxify.end', {url: url});
				});
			}, url);

			return true;
		}

		return false;
	};

	ajaxify.refresh = function() {
		ajaxify.go(ajaxify.currentPage);
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

	ajaxify.isTemplateAvailable = function(tpl) {
		return $.inArray(tpl + '.tpl', availableTemplates) !== -1;
	};

	ajaxify.getTemplateMapping = function(url) {
		var tpl_url = ajaxify.getCustomTemplateMapping(url.split('?')[0]);

		if (tpl_url === false && !templates[url]) {
			if (url === '' || url === '/') {
				tpl_url = 'home';
			} else if (url === 'admin' || url === 'admin/') {
				tpl_url = 'admin/index';
			} else {
				tpl_url = url.split('/');

				while(tpl_url.length) {
					if (ajaxify.isTemplateAvailable(tpl_url.join('/'))) {
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

	ajaxify.getCustomTemplateMapping = function(tpl) {
		if (templatesConfig.custom_mapping && tpl) {
			for (var pattern in templatesConfig.custom_mapping) {
				if (tpl.match(pattern)) {
					return (templatesConfig.custom_mapping[pattern]);
				}
			}
		}

		return false;
	};

	ajaxify.loadData = function(callback, url, template) {
		var location = document.location || window.location,
			api_url = (url === '' || url === '/') ? 'home' : url,
			tpl_url = ajaxify.getCustomTemplateMapping(api_url.split('?')[0]);

		if (!tpl_url) {
			tpl_url = ajaxify.getTemplateMapping(api_url);
		}

		apiXHR = $.ajax({
			url: RELATIVE_PATH + '/api/' + api_url,
			cache: false,
			success: function(data) {
				if (!data) {
					ajaxify.go('404');
					return;
				}

				data.relative_path = RELATIVE_PATH;

				templates.parse(tpl_url, data, function(template) {
					translator.translate(template, function(translatedTemplate) {
						$('#content').html(translatedTemplate);

						ajaxify.variables.parse();

						if (callback) {
							callback(true);
						}
					});
				});
			},
			error: function(data, textStatus) {
				$('#content, #footer').stop(true, true).removeClass('ajaxifying');
				if (data && data.status === 404) {
					return ajaxify.go('404');
				} else if (data && data.status === 403) {
					return ajaxify.go('403');
				} else if (textStatus !== "abort") {
					app.alertError(data.responseJSON.error);
				}
			}
		});
	};

	ajaxify.loadTemplate = function(template, callback) {
		if (templates.cache[template]) {
			callback(templates.cache[template]);
		} else {
			$.ajax({
				url: RELATIVE_PATH + '/templates/' + template + '.tpl' + (config['cache-buster'] ? '?v=' + config['cache-buster'] : ''),
				type: 'GET',
				success: function(data) {
					callback(data.toString());
				},
				error: function(error) {
					throw new Error("Unable to load template: " + template + " (" + error.statusText + ")");
				}
			});
		}
	};

	$('document').ready(function () {
		if (!window.history || !window.history.pushState) {
			return; // no ajaxification for old browsers
		}

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

		templates.registerLoader(ajaxify.loadTemplate);

		$.when($.getJSON(RELATIVE_PATH + '/templates/config.json'), $.getJSON(RELATIVE_PATH + '/api/get_templates_listing')).done(function (config_data, templates_data) {
			templatesConfig = config_data[0];
			availableTemplates = templates_data[0];

			app.load();
		});
	});

}());
