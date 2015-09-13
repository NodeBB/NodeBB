"use strict";

var ajaxify = ajaxify || {};

$(document).ready(function() {

	/*global app, templates, utils, socket, config, RELATIVE_PATH*/

	var location = document.location || window.location,
		rootUrl = location.protocol + '//' + (location.hostname || location.host) + (location.port ? ':' + location.port : ''),
		apiXHR = null,

		translator;

	// Dumb hack to fool ajaxify into thinking translator is still a global
	// When ajaxify is migrated to a require.js module, then this can be merged into the "define" call
	require(['translator'], function(_translator) {
		translator = _translator;
	});

	$(window).on('popstate', function (ev) {
		ev = ev.originalEvent;

		if (ev !== null && ev.state && ev.state.url !== undefined) {
			ajaxify.go(ev.state.url, function() {
				$(window).trigger('action:popstate', {url: ev.state.url});
			}, true);
		}
	});

	ajaxify.currentPage = null;

	ajaxify.go = function (url, callback, quiet) {
		if (!socket.connected) {
			if (ajaxify.reconnectAction) {
				$(window).off('action:reconnected', ajaxify.reconnectAction);
			}
			ajaxify.reconnectAction = function(e) {
				ajaxify.go(url, callback, quiet);
				$(window).off(e);
			};
			$(window).on('action:reconnected', ajaxify.reconnectAction);
		}

		if (ajaxify.handleRedirects(url)) {
			return true;
		}

		app.enterRoom('');

		$(window).off('scroll');

		if ($('#content').hasClass('ajaxifying') && apiXHR) {
			apiXHR.abort();
		}

		url = ajaxify.start(url, quiet);

		$('#footer, #content').removeClass('hide').addClass('ajaxifying');

		ajaxify.loadData(url, function(err, data) {
			if (err) {
				return onAjaxError(err, url, callback, quiet);
			}

			app.template = data.template.name;

			require(['translator'], function(translator) {
				translator.load(config.defaultLang, data.template.name);
				renderTemplate(url, data.template.name, data, callback);
			});
		});

		return true;
	};

	ajaxify.handleRedirects = function(url) {
		url = ajaxify.removeRelativePath(url.replace(/\/$/, '')).toLowerCase();
		var isAdminRoute = url.startsWith('admin') && window.location.pathname.indexOf(RELATIVE_PATH + '/admin') !== 0;
		var uploadsOrApi = url.startsWith('uploads') || url.startsWith('api');
		if (isAdminRoute || uploadsOrApi) {
			window.open(RELATIVE_PATH + '/' + url, '_top');
			return true;
		}
		return false;
	};


	ajaxify.start = function(url, quiet) {
		url = ajaxify.removeRelativePath(url.replace(/^\/|\/$/g, ''));

		$(window).trigger('action:ajaxify.start', {url: url});

		if (!window.location.pathname.match(/\/(403|404)$/g)) {
			app.previousUrl = window.location.href;
		}

		ajaxify.currentPage = url;

		if (window.history && window.history.pushState) {
			window.history[!quiet ? 'pushState' : 'replaceState']({
				url: url
			}, url, RELATIVE_PATH + '/' + url);
		}
		return url;
	};

	function onAjaxError(err, url, callback, quiet) {
		var data = err.data,
			textStatus = err.textStatus;

		if (data) {
			var status = parseInt(data.status, 10);
			if (status === 403 || status === 404 || status === 500 || status === 502 || status === 503) {
				if (status === 502) {
					status = 500;
				}
				if (data.responseJSON) {
					data.responseJSON.config = config;
				}
				$('#footer, #content').removeClass('hide').addClass('ajaxifying');
				return renderTemplate(url, status.toString(), data.responseJSON, callback);
			} else if (status === 401) {
				app.alertError('[[global:please_log_in]]');
				app.previousUrl = url;
				return ajaxify.go('login');
			} else if (status === 302 || status === 308) {
				if (data.responseJSON.external) {
					window.location.href = data.responseJSON.external;
				} else if (typeof data.responseJSON === 'string') {
					ajaxify.go(data.responseJSON.slice(1), callback, quiet);
				}
			}
		} else if (textStatus !== 'abort') {
			app.alertError(data.responseJSON.error);
		}
	}

	function renderTemplate(url, tpl_url, data, callback) {
		$(window).trigger('action:ajaxify.loadingTemplates', {});

		templates.parse(tpl_url, data, function(template) {
			translator.translate(template, function(translatedTemplate) {
				$('#content').html(translatedTemplate);

				ajaxify.end(url, tpl_url);

				if (typeof callback === 'function') {
					callback();
				}

				$('#content, #footer').removeClass('ajaxifying');

				app.refreshTitle(data.title);
			});
		});
	}

	ajaxify.end = function(url, tpl_url) {
		function done() {
			if (--count === 0) {
				$(window).trigger('action:ajaxify.end', {url: url});
			}
		}
		var count = 2;

		ajaxify.variables.parse();

		ajaxify.loadScript(tpl_url, done);

		ajaxify.widgets.render(tpl_url, url, done);

		$(window).trigger('action:ajaxify.contentLoaded', {url: url, tpl: tpl_url});

		app.processPage();
	};

	ajaxify.removeRelativePath = function(url) {
		if (url.startsWith(RELATIVE_PATH.slice(1))) {
			url = url.slice(RELATIVE_PATH.length);
		}
		return url;
	};

	ajaxify.refresh = function(e) {
		if (e && e instanceof jQuery.Event) {
			e.preventDefault();
		}

		ajaxify.go(ajaxify.currentPage, null, true);
	};

	ajaxify.loadScript = function(tpl_url, callback) {
		var location = !app.inAdmin ? 'forum/' : '';

		require([location + tpl_url], function(script) {
			if (script && script.init) {
				script.init();
			}

			if (callback) {
				callback();
			}
		});
	};

	ajaxify.loadData = function(url, callback) {
		url = ajaxify.removeRelativePath(url);

		$(window).trigger('action:ajaxify.loadingData', {url: url});

		apiXHR = $.ajax({
			url: RELATIVE_PATH + '/api/' + url,
			cache: false,
			success: function(data) {
				if (!data) {
					return;
				}

				ajaxify.data = data;
				data.config = config;

				$(window).trigger('action:ajaxify.dataLoaded', {url: url, data: data});

				if (callback) {
					callback(null, data);
				}
			},
			error: function(data, textStatus) {
				if (data.status === 0 && textStatus === 'error') {
					data.status = 500;
				}
				callback({
					data: data,
					textStatus: textStatus
				});
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

	function ajaxifyAnchors() {
		function hrefEmpty(href) {
			return href === undefined || href === '' || href === 'javascript:;';
		}

		// Enhancing all anchors to ajaxify...
		$(document.body).on('click', 'a', function (e) {
			if (this.target !== '' || (this.protocol !== 'http:' && this.protocol !== 'https:')) {
				return;
			} else if (hrefEmpty(this.href) || this.protocol === 'javascript:' || $(this).attr('data-ajaxify') === 'false' || $(this).attr('href') === '#') {
				return e.preventDefault();
			}

			if (!e.ctrlKey && !e.shiftKey && !e.metaKey && e.which === 1) {
				if (
					this.host === '' ||	// Relative paths are always internal links...
					(this.host === window.location.host && this.protocol === window.location.protocol &&	// Otherwise need to check that protocol and host match
					(RELATIVE_PATH.length > 0 ? this.pathname.indexOf(RELATIVE_PATH) === 0 : true))	// Subfolder installs need this additional check
				) {
					// Internal link
					var pathname = this.href.replace(rootUrl + RELATIVE_PATH + '/', '');

					// Special handling for urls with hashes
					if (window.location.pathname === this.pathname && this.hash.length) {
						window.location.hash = this.hash;
					} else {
						if (ajaxify.go(pathname)) {
							e.preventDefault();
						}
					}
				} else if (window.location.pathname !== '/outgoing') {
					// External Link
					if (config.openOutgoingLinksInNewTab) {
						window.open(this.href, '_blank');
						e.preventDefault();
					} else if (config.useOutgoingLinksPage) {
						ajaxify.go('outgoing?url=' + encodeURIComponent(this.href));
						e.preventDefault();
					}
				}
			}
		});
	}

	templates.registerLoader(ajaxify.loadTemplate);

	if (window.history && window.history.pushState) {
		// Progressive Enhancement, ajaxify available only to modern browsers
		ajaxifyAnchors();
	}

	app.load();
	templates.cache['500'] = $('.tpl-500').html();

});