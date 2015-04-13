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

		ajaxify.variables.flush();
		ajaxify.loadData(url, function(err, data) {
			if (err) {
				return onAjaxError(err, url, callback, quiet);
			}

			app.template = data.template.name;

			require(['translator', 'search'], function(translator, search) {
				translator.load(config.defaultLang, data.template.name);
				renderTemplate(url, data.template.name, data, callback);
				search.topicDOM.end();
			});
		});

		return true;
	};

	ajaxify.handleRedirects = function(url) {
		url = ajaxify.removeRelativePath(url.replace(/\/$/, '')).toLowerCase();
		var isAdminRoute = url.startsWith('admin') && window.location.pathname.indexOf(RELATIVE_PATH + '/admin') !== 0;
		var uploadsOrApi = url.startsWith('uploads') || url.startsWith('api');
		if (isAdminRoute || uploadsOrApi) {
			window.open(RELATIVE_PATH + '/' + url, '_blank');
			return true;
		}
		return false;
	};


	ajaxify.start = function(url, quiet, search) {
		url = ajaxify.removeRelativePath(url.replace(/^\/|\/$/g, ''));
		var hash = window.location.hash;
		search = search || '';

		$(window).trigger('action:ajaxify.start', {url: url});

		if (!window.location.pathname.match(/\/(403|404)$/g)) {
			app.previousUrl = window.location.href;
		}

		ajaxify.currentPage = url;

		if (window.history && window.history.pushState) {
			window.history[!quiet ? 'pushState' : 'replaceState']({
				url: url + search + hash
			}, url, RELATIVE_PATH + '/' + url + search + hash);
		}
		return url;
	};

	function onAjaxError(err, url, callback, quiet) {
		var data = err.data,
			textStatus = err.textStatus;

		if (data) {
			var status = parseInt(data.status, 10);

			if (status === 403 || status === 404 || status === 500) {
				$('#footer, #content').removeClass('hide').addClass('ajaxifying');
				return renderTemplate(url, status.toString(), data.responseJSON, (new Date()).getTime(), callback);
			} else if (status === 401) {
				app.alertError('[[global:please_log_in]]');
				app.previousUrl = url;
				return ajaxify.go('login');
			} else if (status === 302) {
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

				app.refreshTitle(url);
			});
		});
	}

	ajaxify.end = function(url, tpl_url) {
		ajaxify.variables.parse();

		ajaxify.loadScript(tpl_url);

		ajaxify.widgets.render(tpl_url, url, function() {
			$(window).trigger('action:ajaxify.end', {url: url});
		});

		$(window).trigger('action:ajaxify.contentLoaded', {url: url});

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

		ajaxify.go(ajaxify.currentPage);
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

				data.relative_path = RELATIVE_PATH;

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
		templates.registerLoader(ajaxify.loadTemplate);

		if (!window.history || !window.history.pushState) {
			return; // no ajaxification for old browsers
		}

		function hrefEmpty(href) {
			return href === undefined || href === '' || href === 'javascript:;' || href === window.location.href + "#" || href.slice(0, 1) === "#";
		}

		// Enhancing all anchors to ajaxify...
		$(document.body).on('click', 'a', function (e) {
			if (this.target !== '') {
				return;
			} else if (hrefEmpty(this.href) || this.protocol === 'javascript:' || $(this).attr('data-ajaxify') === 'false') {
				return e.preventDefault();
			}

			if (!e.ctrlKey && !e.shiftKey && !e.metaKey && e.which === 1) {
				if (this.host === '' || this.host === window.location.host) {
					// Internal link
					var url = this.href.replace(rootUrl + '/', '');

					if(window.location.pathname === this.pathname && this.hash) {
						if (this.hash !== window.location.hash) {
							window.location.hash = this.hash;
						}

						e.preventDefault();
					} else {
						if (ajaxify.go(url)) {
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

	ajaxifyAnchors();
	app.load();
	templates.cache['500'] = $('.tpl-500').html();

});