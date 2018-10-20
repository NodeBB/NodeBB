'use strict';


var ajaxify = window.ajaxify || {};

$(document).ready(function () {
	var location = document.location || window.location;
	var rootUrl = location.protocol + '//' + (location.hostname || location.host) + (location.port ? ':' + location.port : '');
	var apiXHR = null;
	var ajaxifyTimer;

	var translator;
	var Benchpress;
	var retry = true;
	var previousBodyClass = '';

	// Dumb hack to fool ajaxify into thinking translator is still a global
	// When ajaxify is migrated to a require.js module, then this can be merged into the "define" call
	require(['translator', 'benchpress'], function (_translator, _Benchpress) {
		translator = _translator;
		translator.translate('[[error:no-connection]]');
		Benchpress = _Benchpress;
	});

	$(window).on('popstate', function (ev) {
		ev = ev.originalEvent;

		if (ev !== null && ev.state) {
			if (ev.state.url === null && ev.state.returnPath !== undefined) {
				window.history.replaceState({
					url: ev.state.returnPath,
				}, ev.state.returnPath, config.relative_path + '/' + ev.state.returnPath);
			} else if (ev.state.url !== undefined) {
				ajaxify.go(ev.state.url, function () {
					$(window).trigger('action:popstate', { url: ev.state.url });
				}, true);
			}
		}
	});

	ajaxify.count = 0;
	ajaxify.currentPage = null;

	ajaxify.go = function (url, callback, quiet) {
		if (!socket.connected) {
			if (ajaxify.reconnectAction) {
				$(window).off('action:reconnected', ajaxify.reconnectAction);
			}
			ajaxify.reconnectAction = function (e) {
				ajaxify.go(url, callback, quiet);
				$(window).off(e);
			};
			$(window).on('action:reconnected', ajaxify.reconnectAction);
		}

		// Abort subsequent requests if clicked multiple times within a short window of time
		if (ajaxifyTimer && (Date.now() - ajaxifyTimer) < 500) {
			return true;
		}
		ajaxifyTimer = Date.now();

		if (ajaxify.handleRedirects(url)) {
			return true;
		}

		app.leaveCurrentRoom();

		$(window).off('scroll');

		if ($('#content').hasClass('ajaxifying') && apiXHR) {
			apiXHR.abort();
		}

		app.previousUrl = window.location.href;

		url = ajaxify.start(url);

		// If any listeners alter url and set it to an empty string, abort the ajaxification
		if (url === null) {
			$(window).trigger('action:ajaxify.end', { url: url, tpl_url: ajaxify.data.template.name, title: ajaxify.data.title });
			return false;
		}

		previousBodyClass = ajaxify.data.bodyClass;
		$('#footer, #content').removeClass('hide').addClass('ajaxifying');

		ajaxify.loadData(url, function (err, data) {
			if (!err || (err && err.data && (parseInt(err.data.status, 10) !== 302 && parseInt(err.data.status, 10) !== 308))) {
				ajaxify.updateHistory(url, quiet);
			}

			if (err) {
				return onAjaxError(err, url, callback, quiet);
			}

			retry = true;
			app.template = data.template.name;

			renderTemplate(url, data.templateToRender || data.template.name, data, callback);
		});

		return true;
	};

	ajaxify.isCold = function () {
		return ajaxify.count <= 1;
	};

	ajaxify.handleRedirects = function (url) {
		url = ajaxify.removeRelativePath(url.replace(/^\/|\/$/g, '')).toLowerCase();
		var isClientToAdmin = url.startsWith('admin') && window.location.pathname.indexOf(config.relative_path + '/admin') !== 0;
		var isAdminToClient = !url.startsWith('admin') && window.location.pathname.indexOf(config.relative_path + '/admin') === 0;

		if (isClientToAdmin || isAdminToClient) {
			window.open(config.relative_path + '/' + url, '_top');
			return true;
		}
		return false;
	};

	ajaxify.start = function (url) {
		url = ajaxify.removeRelativePath(url.replace(/^\/|\/$/g, ''));

		var payload = {
			url: url,
		};

		$(window).trigger('action:ajaxify.start', payload);

		ajaxify.count += 1;

		return payload.url;
	};

	ajaxify.updateHistory = function (url, quiet) {
		ajaxify.currentPage = url.split(/[?#]/)[0];
		if (window.history && window.history.pushState) {
			window.history[!quiet ? 'pushState' : 'replaceState']({
				url: url,
			}, url, config.relative_path + '/' + url);
		}
	};

	function onAjaxError(err, url, callback, quiet) {
		var data = err.data;
		var textStatus = err.textStatus;

		if (data) {
			var status = parseInt(data.status, 10);
			if (status === 403 || status === 404 || status === 500 || status === 502 || status === 503) {
				if (status === 502 && retry) {
					retry = false;
					ajaxifyTimer = undefined;
					return ajaxify.go(url, callback, quiet);
				}
				if (status === 502) {
					status = 500;
				}
				if (data.responseJSON) {
					data.responseJSON.config = config;
				}

				$('#footer, #content').removeClass('hide').addClass('ajaxifying');
				return renderTemplate(url, status.toString(), data.responseJSON || {}, callback);
			} else if (status === 401) {
				app.alertError('[[global:please_log_in]]');
				app.previousUrl = url;
				window.location.href = config.relative_path + '/login';
			} else if (status === 302 || status === 308) {
				if (data.responseJSON && data.responseJSON.external) {
					window.location.href = data.responseJSON.external;
				} else if (typeof data.responseJSON === 'string') {
					ajaxifyTimer = undefined;
					ajaxify.go(data.responseJSON.slice(1), callback, quiet);
				}
			}
		} else if (textStatus !== 'abort') {
			app.alertError(data.responseJSON.error);
		}
	}

	function renderTemplate(url, tpl_url, data, callback) {
		$(window).trigger('action:ajaxify.loadingTemplates', {});

		Benchpress.parse(tpl_url, data, function (template) {
			translator.translate(template, function (translatedTemplate) {
				translatedTemplate = translator.unescape(translatedTemplate);
				$('body').removeClass(previousBodyClass).addClass(data.bodyClass);
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

	ajaxify.end = function (url, tpl_url) {
		var count = 2;
		function done() {
			count -= 1;
			if (count === 0) {
				$(window).trigger('action:ajaxify.end', { url: url, tpl_url: tpl_url, title: ajaxify.data.title });
			}
		}
		ajaxify.loadScript(tpl_url, done);
		ajaxify.widgets.render(tpl_url, done);

		$(window).trigger('action:ajaxify.contentLoaded', { url: url, tpl: tpl_url });

		app.processPage();
	};

	ajaxify.parseData = function () {
		var dataEl = $('#ajaxify-data');
		if (dataEl.length) {
			ajaxify.data = JSON.parse(dataEl.text());
			dataEl.remove();
		}
	};

	ajaxify.removeRelativePath = function (url) {
		if (url.startsWith(config.relative_path.slice(1))) {
			url = url.slice(config.relative_path.length);
		}
		return url;
	};

	ajaxify.refresh = function (callback) {
		ajaxify.go(ajaxify.currentPage + window.location.search + window.location.hash, callback, true);
	};

	ajaxify.loadScript = function (tpl_url, callback) {
		var location = !app.inAdmin ? 'forum/' : '';

		if (tpl_url.startsWith('admin')) {
			location = '';
		}
		var data = {
			tpl_url: tpl_url,
			scripts: [location + tpl_url],
		};

		$(window).trigger('action:script.load', data);

		// Require and parse modules
		var outstanding = data.scripts.length;

		data.scripts.map(function (script) {
			if (typeof script === 'function') {
				return function (next) {
					script();
					next();
				};
			}
			if (typeof script === 'string') {
				return function (next) {
					require([script], function (script) {
						if (script && script.init) {
							script.init();
						}
						next();
					}, function () {
						// ignore 404 error
						next();
					});
				};
			}
			return null;
		}).filter(Boolean).forEach(function (fn) {
			fn(function () {
				outstanding -= 1;
				if (outstanding === 0) {
					callback();
				}
			});
		});
	};

	ajaxify.loadData = function (url, callback) {
		url = ajaxify.removeRelativePath(url);

		$(window).trigger('action:ajaxify.loadingData', { url: url });

		apiXHR = $.ajax({
			url: config.relative_path + '/api/' + url,
			cache: false,
			headers: {
				'X-Return-To': app.previousUrl,
			},
			success: function (data, textStatus, xhr) {
				if (!data) {
					return;
				}

				if (xhr.getResponseHeader('X-Redirect')) {
					return callback({
						data: {
							status: 302,
							responseJSON: data,
						},
						textStatus: 'error',
					});
				}

				ajaxify.data = data;
				data.config = config;

				$(window).trigger('action:ajaxify.dataLoaded', { url: url, data: data });

				callback(null, data);
			},
			error: function (data, textStatus) {
				if (data.status === 0 && textStatus === 'error') {
					data.status = 500;
					data.responseJSON = data.responseJSON || {};
					data.responseJSON.error = '[[error:no-connection]]';
				}
				callback({
					data: data,
					textStatus: textStatus,
				});
			},
		});
	};

	ajaxify.loadTemplate = function (template, callback) {
		require([config.relative_path + '/assets/templates/' + template + '.js'], callback, function (err) {
			console.error('Unable to load template: ' + template);
			throw err;
		});
	};

	function ajaxifyAnchors() {
		function hrefEmpty(href) {
			return href === undefined || href === '' || href === 'javascript:;';
		}

		var contentEl = document.getElementById('content');

		// Enhancing all anchors to ajaxify...
		$(document.body).on('click', 'a', function (e) {
			var _self = this;
			if (this.target !== '' || (this.protocol !== 'http:' && this.protocol !== 'https:')) {
				return;
			}

			var internalLink = utils.isInternalURI(this, window.location, config.relative_path);

			var process = function () {
				if (!e.ctrlKey && !e.shiftKey && !e.metaKey && e.which === 1) {
					if (internalLink) {
						var pathname = this.href.replace(rootUrl + config.relative_path + '/', '');

						// Special handling for urls with hashes
						if (window.location.pathname === this.pathname && this.hash.length) {
							window.location.hash = this.hash;
						} else if (ajaxify.go(pathname)) {
							e.preventDefault();
						}
					} else if (window.location.pathname !== config.relative_path + '/outgoing') {
						if (config.openOutgoingLinksInNewTab && $.contains(contentEl, this)) {
							var externalTab = window.open();
							externalTab.opener = null;
							externalTab.location = this.href;
							e.preventDefault();
						} else if (config.useOutgoingLinksPage) {
							var safeUrls = config.outgoingLinksWhitelist.trim().split(/[\s,]+/g).filter(Boolean);
							var href = this.href;
							if (!safeUrls.length || !safeUrls.some(function (url) { return href.indexOf(url) !== -1; })) {
								ajaxify.go('outgoing?url=' + encodeURIComponent(href));
								e.preventDefault();
							}
						}
					}
				}
			};

			if ($(this).attr('data-ajaxify') === 'false') {
				if (!internalLink) {
					return;
				}
				return e.preventDefault();
			}

			// Default behaviour for rss feeds
			if (internalLink && $(this).attr('href') && $(this).attr('href').endsWith('.rss')) {
				return;
			}

			// Default behaviour for uploads and direct links to API urls
			if (internalLink && ['/uploads', '/assets/uploads/', '/api/'].some(function (prefix) {
				return String(_self.pathname).startsWith(config.relative_path + prefix);
			})) {
				return;
			}

			if (hrefEmpty(this.href) || this.protocol === 'javascript:' || $(this).attr('href') === '#') {
				return e.preventDefault();
			}

			if (app.flags && app.flags.hasOwnProperty('_unsaved') && app.flags._unsaved === true) {
				if (e.ctrlKey) {
					return;
				}

				translator.translate('[[global:unsaved-changes]]', function (text) {
					bootbox.confirm(text, function (navigate) {
						if (navigate) {
							app.flags._unsaved = false;
							process.call(_self);
						}
					});
				});
				return e.preventDefault();
			}

			process.call(_self);
		});
	}

	require(['benchpress'], function (Benchpress) {
		Benchpress.registerLoader(ajaxify.loadTemplate);
	});

	if (window.history && window.history.pushState) {
		// Progressive Enhancement, ajaxify available only to modern browsers
		ajaxifyAnchors();
	}

	app.load();
});
