'use strict';

const benchpress = require('benchpressjs');
const translator = require('./modules/translator');
const alerts = require('./modules/alerts');
const hooks = require('./modules/hooks');
const { render } = require('./widgets');

window.ajaxify = window.ajaxify || {};
ajaxify.widgets = { render: render };
(function () {
	let apiXHR = null;
	let ajaxifyTimer;

	let retry = true;
	let previousBodyClass = '';

	ajaxify.count = 0;
	ajaxify.currentPage = null;
	ajaxify.requestedPage = null;
	// disables scroll to top when back button is clicked
	// https://developer.chrome.com/blog/history-api-scroll-restoration/
	if ('scrollRestoration' in history) {
		history.scrollRestoration = 'manual';
	}

	ajaxify.check = (item) => {
		/**
		 * returns:
		 *   true  (ajaxify OK)
		 *   false (browser default)
		 *   null  (no action)
		 */
		let urlObj;
		let pathname = item instanceof Element ? item.getAttribute('href') : undefined;
		try {
			urlObj = new URL(item, `${document.location.origin}${config.relative_path}`);
			if (!pathname) {
				({ pathname } = urlObj);
			}
		} catch (err) {
			console.error(err);
			return false;
		}

		const internalLink = utils.isInternalURI(urlObj, window.location, config.relative_path);

		const hrefEmpty = href => href === undefined || href === '' || href === 'javascript:;';

		if (item instanceof Element) {
			if (item.getAttribute('data-ajaxify') === 'false') {
				if (!internalLink) {
					return false;
				}

				return null;
			}

			if (hrefEmpty(urlObj.href) || urlObj.protocol === 'javascript:' || pathname === '#' || pathname === '') {
				return null;
			}
		}

		if (internalLink) {
			// Default behaviour for rss feeds
			if (pathname.endsWith('.rss')) {
				return false;
			}

			// Default behaviour for sitemap
			if (String(pathname).startsWith(config.relative_path + '/sitemap') && pathname.endsWith('.xml')) {
				return false;
			}

			// Default behaviour for uploads and direct links to API urls
			if (['/uploads', '/assets/', '/api/'].some(function (prefix) {
				return String(pathname).startsWith(config.relative_path + prefix);
			})) {
				return false;
			}
		}

		return true;
	};

	ajaxify.go = function (url, callback, quiet) {
		// Automatically reconnect to socket and re-ajaxify on success
		if (!socket.connected && parseInt(app.user.uid, 10) >= 0) {
			app.reconnect();

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
		if (ajaxify.requestedPage === url && ajaxifyTimer && (Date.now() - ajaxifyTimer) < 500) {
			return true;
		}
		ajaxifyTimer = Date.now();
		ajaxify.requestedPage = url;

		if (ajaxify.handleRedirects(url)) {
			return true;
		}

		if (!quiet && url === ajaxify.currentPage + window.location.search + window.location.hash) {
			quiet = true;
		}

		ajaxify.cleanup(url, ajaxify.data.template.name);

		if ($('#content').hasClass('ajaxifying') && apiXHR) {
			apiXHR.abort();
		}

		app.previousUrl = !['reset'].includes(ajaxify.currentPage) ?
			window.location.pathname.slice(config.relative_path.length) + window.location.search :
			app.previousUrl;

		url = ajaxify.start(url);

		// If any listeners alter url and set it to an empty string, abort the ajaxification
		if (url === null) {
			hooks.fire('action:ajaxify.end', { url: url, tpl_url: ajaxify.data.template.name, title: ajaxify.data.title });
			return false;
		}

		previousBodyClass = ajaxify.data.bodyClass;
		$('#footer, #content').removeClass('hide').addClass('ajaxifying');

		ajaxify.loadData(url, function (err, data) {
			if (!err || (
				err &&
				err.data &&
				(parseInt(err.data.status, 10) !== 302 && parseInt(err.data.status, 10) !== 308)
			)) {
				ajaxify.updateHistory(url, quiet);
			}

			if (err) {
				return onAjaxError(err, url, callback, quiet);
			}

			retry = true;

			renderTemplate(url, data.templateToRender || data.template.name, data, callback);
		});

		return true;
	};

	// this function is called just once from footer on page load
	ajaxify.coldLoad = function () {
		const url = ajaxify.start(window.location.pathname.slice(1) + window.location.search + window.location.hash);
		ajaxify.updateHistory(url, true);
		ajaxify.end(url, ajaxify.data.template.name);
		hooks.fire('action:ajaxify.coldLoad');
	};

	ajaxify.isCold = function () {
		return ajaxify.count <= 1;
	};

	ajaxify.handleRedirects = function (url) {
		url = ajaxify.removeRelativePath(url.replace(/^\/|\/$/g, '')).toLowerCase();
		const isClientToAdmin = url.startsWith('admin') && window.location.pathname.indexOf(config.relative_path + '/admin') !== 0;
		const isAdminToClient = !url.startsWith('admin') && window.location.pathname.indexOf(config.relative_path + '/admin') === 0;

		if (isClientToAdmin || isAdminToClient) {
			window.open(config.relative_path + '/' + url, '_top');
			return true;
		}
		return false;
	};

	ajaxify.start = function (url) {
		url = ajaxify.removeRelativePath(url.replace(/^\/|\/$/g, ''));

		const payload = {
			url: url,
		};

		hooks.logs.collect();
		hooks.fire('action:ajaxify.start', payload);

		ajaxify.count += 1;

		return payload.url;
	};

	ajaxify.updateHistory = function (url, quiet) {
		ajaxify.currentPage = url.split(/[?#]/)[0];
		ajaxify.requestedPage = null;
		if (window.history && window.history.pushState) {
			window.history[!quiet ? 'pushState' : 'replaceState']({
				url: url,
			}, url, config.relative_path + '/' + url);
		}
	};

	function onAjaxError(err, url, callback, quiet) {
		const data = err.data;
		const textStatus = err.textStatus;

		if (data) {
			let status = parseInt(data.status, 10);
			if ([400, 403, 404, 500, 502, 503].includes(status)) {
				if (status === 502 && retry) {
					retry = false;
					ajaxifyTimer = undefined;
					return ajaxify.go(url, callback, quiet);
				}
				if (status === 502) {
					status = 500;
				}
				if (data.responseJSON) {
					ajaxify.data.bodyClass = data.responseJSON.bodyClass;
					data.responseJSON.config = config;
				}

				$('#footer, #content').removeClass('hide').addClass('ajaxifying');
				return renderTemplate(url, status.toString(), data.responseJSON || {}, callback);
			} else if (status === 401) {
				alerts.error('[[global:please-log-in]]');
				app.previousUrl = url;
				window.location.href = config.relative_path + '/login';
			} else if (status === 302 || status === 308) {
				if (data.responseJSON && data.responseJSON.external) {
					// this is used by sso plugins to redirect to the auth route
					// cant use ajaxify.go for /auth/sso routes
					window.location.href = data.responseJSON.external;
				} else if (typeof data.responseJSON === 'string') {
					ajaxifyTimer = undefined;
					if (data.responseJSON.startsWith('http://') || data.responseJSON.startsWith('https://')) {
						window.location.href = data.responseJSON;
					} else {
						ajaxify.go(data.responseJSON.slice(1), callback, quiet);
					}
				}
			}
		} else if (textStatus !== 'abort') {
			alerts.error(data.responseJSON.error);
		}
	}

	function renderTemplate(url, tpl_url, data, callback) {
		hooks.fire('action:ajaxify.loadingTemplates', {});
		benchpress.render(tpl_url, data)
			.then(rendered => translator.translate(rendered))
			.then(function (translated) {
				translated = translator.unescape(translated);
				$('body').removeClass(previousBodyClass).addClass(data.bodyClass);
				$('#content').html(translated);

				ajaxify.end(url, tpl_url);

				if (typeof callback === 'function') {
					callback();
				}

				$('#content, #footer').removeClass('ajaxifying');

				// Only executed on ajaxify. Otherwise these'd be in ajaxify.end()
				updateTitle(data.title);
				updateTags();
			});
	}

	function updateTitle(title) {
		if (!title) {
			return;
		}

		title = config.titleLayout.replace(/&#123;/g, '{').replace(/&#125;/g, '}')
			.replace('{pageTitle}', function () { return title; })
			.replace('{browserTitle}', function () { return config.browserTitle; });

		// Allow translation strings in title on ajaxify (#5927)
		title = translator.unescape(title);
		const data = { title: title };
		hooks.fire('action:ajaxify.updateTitle', data);
		translator.translate(data.title, function (translated) {
			window.document.title = $('<div></div>').html(translated).text();
		});
	}
	ajaxify.updateTitle = updateTitle;

	function updateTags() {
		const metaWhitelist = ['title', 'description', /og:.+/, /article:.+/, 'robots'].map(function (val) {
			return new RegExp(val);
		});
		const linkWhitelist = ['canonical', 'alternate', 'up'];

		// Delete the old meta tags
		Array.prototype.slice
			.call(document.querySelectorAll('head meta'))
			.filter(function (el) {
				const name = el.getAttribute('property') || el.getAttribute('name');
				return metaWhitelist.some(function (exp) {
					return !!exp.test(name);
				});
			})
			.forEach(function (el) {
				document.head.removeChild(el);
			});

		// Add new meta tags
		ajaxify.data._header.tags.meta
			.filter(function (tagObj) {
				const name = tagObj.name || tagObj.property;
				return metaWhitelist.some(function (exp) {
					return !!exp.test(name);
				});
			}).forEach(async function (tagObj) {
				if (tagObj.content) {
					tagObj.content = await translator.translate(tagObj.content);
				}
				const metaEl = document.createElement('meta');
				Object.keys(tagObj).forEach(function (prop) {
					metaEl.setAttribute(prop, tagObj[prop]);
				});
				document.head.appendChild(metaEl);
			});


		// Delete the old link tags
		Array.prototype.slice
			.call(document.querySelectorAll('head link'))
			.filter(function (el) {
				const name = el.getAttribute('rel');
				return linkWhitelist.some(function (item) {
					return item === name;
				});
			})
			.forEach(function (el) {
				document.head.removeChild(el);
			});

		// Add new link tags
		ajaxify.data._header.tags.link
			.filter(function (tagObj) {
				return linkWhitelist.some(function (item) {
					return item === tagObj.rel;
				});
			})
			.forEach(function (tagObj) {
				const linkEl = document.createElement('link');
				Object.keys(tagObj).forEach(function (prop) {
					linkEl.setAttribute(prop, tagObj[prop]);
				});
				document.head.appendChild(linkEl);
			});
	}

	ajaxify.end = function (url, tpl_url) {
		// Scroll back to top of page
		if (!ajaxify.isCold()) {
			window.scrollTo(0, 0);
			// if on topic page, scroll to the correct post,
			// this is here to avoid a flash of the wrong posts at the top of the page
			require(['navigator'], function (navigator) {
				if (navigator.shouldScrollToPost(ajaxify.data.postIndex)) {
					navigator.scrollToPostIndex(ajaxify.data.postIndex - 1, true, 0);
				}
			});
		}
		ajaxify.loadScript(tpl_url, function done() {
			hooks.fire('action:ajaxify.end', { url: url, tpl_url: tpl_url, title: ajaxify.data.title });
			hooks.logs.flush();
		});
		ajaxify.widgets.render(tpl_url);

		hooks.fire('action:ajaxify.contentLoaded', { url: url, tpl: tpl_url });

		app.processPage();
	};

	ajaxify.parseData = () => {
		const dataEl = document.getElementById('ajaxify-data');
		if (dataEl) {
			try {
				ajaxify.data = JSON.parse(dataEl.textContent);
			} catch (e) {
				console.error(e);
				ajaxify.data = {};
			} finally {
				dataEl.remove();
			}
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
		let location = !app.inAdmin ? 'forum/' : '';

		if (tpl_url.startsWith('admin')) {
			location = '';
		}
		const data = {
			tpl_url: tpl_url,
			scripts: [location + tpl_url],
		};

		// Hint: useful if you want to load a module on a specific page (append module name to `scripts`)
		hooks.fire('action:script.load', data);
		hooks.fire('filter:script.load', data).then((data) => {
			// Require and parse modules
			let outstanding = data.scripts.length;

			const scripts = data.scripts.map(function (script) {
				if (typeof script === 'function') {
					return function (next) {
						script();
						next();
					};
				}
				if (typeof script === 'string') {
					return async function (next) {
						const module = await app.require(script);
						// Hint: useful if you want to override a loaded library (e.g. replace core client-side logic),
						// or call a method other than .init()
						hooks.fire('static:script.init', { tpl_url, name: script, module }).then(() => {
							if (module && module.init) {
								module.init();
							}
							next();
						});
					};
				}
				return null;
			}).filter(Boolean);

			if (scripts.length) {
				scripts.forEach(function (fn) {
					fn(function () {
						outstanding -= 1;
						if (outstanding === 0) {
							callback();
						}
					});
				});
			} else {
				callback();
			}
		});
	};

	ajaxify.loadData = function (url, callback) {
		url = ajaxify.removeRelativePath(url);

		hooks.fire('action:ajaxify.loadingData', { url: url });

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

				hooks.fire('action:ajaxify.dataLoaded', { url: url, data: data });

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
		$.ajax({
			url: `${config.asset_base_url}/templates/${template}.js`,
			cache: false,
			dataType: 'text',
			success: function (script) {
				const renderFunction = new Function('module', script);
				const moduleObj = { exports: {} };
				renderFunction(moduleObj);
				callback(moduleObj.exports);
			},
		}).fail(function () {
			console.error('Unable to load template: ' + template);
			callback(new Error('[[error:unable-to-load-template]]'));
		});
	};

	ajaxify.cleanup = (url, tpl_url) => {
		app.leaveCurrentRoom();
		$(window).off('scroll');
		hooks.fire('action:ajaxify.cleanup', { url, tpl_url });
	};

	ajaxify.handleTransientElements = () => {
		// todo: modals?

		const elements = ['[component="notifications"]', '[component="chat/dropdown"]', '[component="sidebar/drafts"]', '[component="header/avatar"]']
			.map(el => document.querySelector(`${el} .dropdown-menu.show`) || document.querySelector(`${el} + .dropdown-menu.show`))
			.filter(Boolean);

		if (elements.length) {
			elements.forEach((el) => {
				el.classList.remove('show');
			});
		}
	};

	translator.translate('[[error:no-connection]]');
	translator.translate('[[error:socket-reconnect-failed]]');
	translator.translate(`[[global:reconnecting-message, ${config.siteTitle}]]`);
	benchpress.registerLoader(ajaxify.loadTemplate);
	benchpress.setGlobal('config', config);
	benchpress.render('500', {}); // loads and caches 500.tpl
	benchpress.render('partials/toast'); // loads and caches partials/toast
}());

$(document).ready(function () {
	window.addEventListener('popstate', (ev) => {
		if (ev !== null && ev.state) {
			if (ev.state.url === null && ev.state.returnPath !== undefined) {
				window.history.replaceState({
					url: ev.state.returnPath,
				}, ev.state.returnPath, config.relative_path + '/' + ev.state.returnPath);
			} else if (ev.state.url !== undefined) {
				ajaxify.handleTransientElements();
				ajaxify.go(ev.state.url, function () {
					hooks.fire('action:popstate', { url: ev.state.url });
				}, true);
			}
		}
	});

	function ajaxifyAnchors() {
		const location = document.location || window.location;
		const rootUrl = location.protocol + '//' + (location.hostname || location.host) + (location.port ? ':' + location.port : '');
		const contentEl = document.getElementById('content');

		// Enhancing all anchors to ajaxify...
		$(document.body).on('click', 'a', function (e) {
			const _self = this;
			if (this.target !== '' || (this.protocol !== 'http:' && this.protocol !== 'https:')) {
				return;
			}

			const internalLink = utils.isInternalURI(this, window.location, config.relative_path);
			const rootAndPath = new RegExp(`^${rootUrl}${config.relative_path}/?`);
			const process = function () {
				if (!e.ctrlKey && !e.shiftKey && !e.metaKey && e.which === 1) {
					if (internalLink) {
						const pathname = this.href.replace(rootAndPath, '');

						// Special handling for urls with hashes
						if (window.location.pathname === this.pathname && this.hash.length) {
							window.location.hash = this.hash;
						} else if (ajaxify.go(pathname)) {
							e.preventDefault();
						}
					} else if (window.location.pathname !== config.relative_path + '/outgoing') {
						if (config.openOutgoingLinksInNewTab && $.contains(contentEl, this)) {
							const externalTab = window.open();
							externalTab.opener = null;
							externalTab.location = this.href;
							e.preventDefault();
						} else if (config.useOutgoingLinksPage) {
							const safeUrls = config.outgoingLinksWhitelist.trim().split(/[\s,]+/g).filter(Boolean);
							const href = this.href;
							if (!safeUrls.length || !safeUrls.some(function (url) { return href.indexOf(url) !== -1; })) {
								ajaxify.go('outgoing?url=' + encodeURIComponent(href));
								e.preventDefault();
							}
						} else if (config.activitypub.probe) {
							ajaxify.go(`ap?resource=${encodeURIComponent(this.href)}`);
							e.preventDefault();
						}
					}
				}
			};

			const check = ajaxify.check(this);
			switch (check) {
				case true: {
					if (app.flags && app.flags.hasOwnProperty('_unsaved') && app.flags._unsaved === true) {
						if (e.ctrlKey) {
							return;
						}

						require(['bootbox'], function (bootbox) {
							bootbox.confirm('[[global:unsaved-changes]]', function (navigate) {
								if (navigate) {
									app.flags._unsaved = false;
									process.call(_self);
								}
							});
						});
						return e.preventDefault();
					}

					process.call(_self);
					break;
				}

				case null: {
					e.preventDefault();
					break;
				}

				// default is default browser behaviour
			}
		});
	}

	if (window.history && window.history.pushState) {
		// Progressive Enhancement, ajaxify available only to modern browsers
		ajaxifyAnchors();
	}
});
