"use strict";

var ajaxify = ajaxify || {
	isPopState: false
};

$(document).ready(function() {
	require(['templates', 'ajaxifyCache'], function (templatesModule, cache) {
		/*global app, templates, utils, socket, translator, config, RELATIVE_PATH*/

		var location = document.location || window.location,
			rootUrl = location.protocol + '//' + (location.hostname || location.host) + (location.port ? ':' + location.port : ''),
			apiXHR = null;


		window.onpopstate = function (event) {
			if (event !== null && event.state && event.state.url !== undefined && !ajaxify.initialLoad) {
				ajaxify.isPopState = true;
				ajaxify.go(event.state.url, function() {
					ajaxify.isPopState = false;
					$(window).trigger('action:popstate', {url: event.state.url});
				}, true);
			}
		};

		ajaxify.currentPage = null;
		ajaxify.initialLoad = false;


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
					if (data.responseJSON.path) {
						if (!ajaxify.go(data.responseJSON.path, callback, quiet)) {
							window.location.href = data.responseJSON.path;
						}
					} else if (data.responseJSON) {
						ajaxify.go(data.responseJSON.slice(1), callback, quiet);
					}
				}
			} else if (textStatus !== 'abort') {
				app.alertError(data.responseJSON.error);
			}
		}

		ajaxify.go = function (url, callback, quiet) {
			// "quiet": If set to true, will not call pushState
			app.enterRoom('');

			// If the url is in the cache, load from cache instead
			if (cache.get(url)) { return true; }
			else {
				cache.url = ajaxify.currentPage;
				ajaxify.isPopState = false;
			}

			$(window).off('scroll');

			if ($('#content').hasClass('ajaxifying') && apiXHR) {
				apiXHR.abort();
			}

			// Remove relative path and trailing slash
			url = ajaxify.removeRelativePath(url.replace(/\/$/, ''));

			var tpl_url = ajaxify.getTemplateMapping(url);

			$(window).trigger('action:ajaxify.start', {url: url, tpl_url: tpl_url});

			var hash = '';
			if(ajaxify.initialLoad) {
				hash = window.location.hash ? window.location.hash : '';
			}

			if (ajaxify.isTemplateAvailable(tpl_url) && !!!templatesModule.config.force_refresh[tpl_url]) {
				ajaxify.currentPage = url;

				if (window.history && window.history.pushState) {
					window.history[!quiet ? 'pushState' : 'replaceState']({
						url: url + hash
					}, url, RELATIVE_PATH + '/' + url + hash);
				}

				translator.load(config.defaultLang, tpl_url);

				$('#footer, #content').removeClass('hide').addClass('ajaxifying');

				var	startTime = (new Date()).getTime();

				ajaxify.variables.flush();
				ajaxify.loadData(url, function(err, data) {
					if (err) {
						return onAjaxError(err, url, callback, quiet);
					}

					renderTemplate(url, tpl_url, data, startTime, callback);

					require(['search'], function(search) {
						search.topicDOM.end();
					});
				});

				return true;
			}

			return false;
		};

		function renderTemplate(url, tpl_url, data, startTime, callback) {
			var animationDuration = parseFloat($('#content').css('transition-duration')) || 0.2;
			$(window).trigger('action:ajaxify.loadingTemplates', {});

			templates.parse(tpl_url, data, function(template) {
				translator.translate(template, function(translatedTemplate) {
					setTimeout(function() {
						cache.set();
						$('#content').html(translatedTemplate);

						ajaxify.variables.parse();

						ajaxify.widgets.render(tpl_url, url, function() {
							$(window).trigger('action:ajaxify.end', {url: url, tpl_url: tpl_url});
						});

						$(window).trigger('action:ajaxify.contentLoaded', {url: url});

						ajaxify.loadScript(tpl_url);

						if (typeof callback === 'function') {
							callback();
						}

						app.processPage();

						$('#content, #footer').removeClass('ajaxifying');
						ajaxify.initialLoad = false;

						app.refreshTitle(url);
					}, animationDuration * 1000 - ((new Date()).getTime() - startTime));

				});
			});

		}

		ajaxify.removeRelativePath = function(url) {
			if (url.indexOf(RELATIVE_PATH.slice(1)) === 0) {
				url = url.slice(RELATIVE_PATH.length);
			}
			return url;
		};

		ajaxify.refresh = function() {
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

		ajaxify.isTemplateAvailable = function(tpl) {
			return $.inArray(tpl + '.tpl', templatesModule.available) !== -1;
		};

		ajaxify.getTemplateMapping = function(url) {
			var tpl_url = ajaxify.getCustomTemplateMapping(url.split('?')[0]);

			if (tpl_url === false && !templates[url]) {
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
			} else if (templates[url]) {
				tpl_url = url;
			}

			return tpl_url;
		};

		ajaxify.getCustomTemplateMapping = function(tpl) {
			if (templatesModule.config && templatesModule.config.custom_mapping && tpl !== undefined) {
				for (var pattern in templatesModule.config.custom_mapping) {
					var match = tpl.match(pattern);
					if (match && match[0] === tpl) {
						return (templatesModule.config.custom_mapping[pattern]);
					}
				}
			}

			return false;
		};

		ajaxify.loadData = function(url, callback) {
			url = ajaxify.removeRelativePath(url);

			$(window).trigger('action:ajaxify.loadingData', {url: url});

			var location = document.location || window.location,
				tpl_url = ajaxify.getCustomTemplateMapping(url.split('?')[0]);

			if (!tpl_url) {
				tpl_url = ajaxify.getTemplateMapping(url);
			}

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

		$('document').ready(function () {
			templates.registerLoader(ajaxify.loadTemplate);
			templatesModule.refresh(app.load);

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

				if (!window.location.pathname.match(/\/(403|404)$/g)) {
					app.previousUrl = window.location.href;
				}

				if (!e.ctrlKey && !e.shiftKey && !e.metaKey && e.which === 1) {
					if (this.host === '' || this.host === window.location.host) {
						// Internal link
						var url = this.href.replace(rootUrl + '/', '');

						if(window.location.pathname === this.pathname && this.hash) {
							if (this.hash !== window.location.hash) {
								window.location.hash = this.hash;
							}

							ajaxify.loadScript(ajaxify.getTemplateMapping(url));
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

		});

	});
});