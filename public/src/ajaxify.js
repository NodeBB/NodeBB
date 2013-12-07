"use strict";

var ajaxify = {};

(function ($) {
	/*global app, templates, utils*/

	var location = document.location || window.location,
		rootUrl = location.protocol + '//' + (location.hostname || location.host) + (location.port ? ':' + location.port : ''),
		content = null;

	var current_state = null;
	var executed = {};

	var events = [];
	ajaxify.register_events = function (new_page_events) {
		for (var i = 0, ii = events.length; i < ii; i++) {
			socket.removeAllListeners(events[i]); // optimize this to user removeListener(event, listener) instead.
		}

		events = new_page_events;
	};


	window.onpopstate = function (event) {
		// "quiet": If set to true, will not call pushState
		if (event !== null && event.state && event.state.url !== undefined) {
			ajaxify.go(event.state.url, null, null, true);
		}
	};

	var pagination, paginator_bar;

	ajaxify.go = function (url, callback, template, quiet) {
		// start: the following should be set like so: ajaxify.onchange(function(){}); where the code actually belongs
		$(window).off('scroll');
		app.enterRoom('global');

		pagination = pagination || document.getElementById('pagination');
		paginator_bar = pagination ? document.body.querySelector('.progress-container') : undefined;
		if (pagination) {
			pagination.parentNode.style.display = 'none';
			paginator_bar.style.display = 'none';
		}

		window.onscroll = null;
		// end

		// Remove trailing slash
		url = url.replace(/\/$/, "");

		var hash = window.location.hash;

		if (url.indexOf(RELATIVE_PATH.slice(1)) !== -1) {
			url = url.slice(RELATIVE_PATH.length);
		}

		var tpl_url = templates.get_custom_map(url.split('?')[0]);

		if (tpl_url == false && !templates[url]) {
			if (url === '' || url === '/') {
				tpl_url = 'home';
			} else {
				tpl_url = url.split('/')[0].split('?')[0];
			}

		} else if (templates[url]) {
			tpl_url = url;
		}

		if (templates.is_available(tpl_url) && !templates.force_refresh(tpl_url)) {
			if (window.history && window.history.pushState) {
				window.history[!quiet ? 'pushState' : 'replaceState']({
					url: url
				}, url, RELATIVE_PATH + '/' + url);

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

			jQuery('#footer, #content').addClass('ajaxifying');

			templates.flush();
			templates.load_template(function () {
				exec_body_scripts(content);
				require(['forum/' + tpl_url], function(script) {
					if (script && script.init) {
						script.init();
					}
				});

				if (callback) {
					callback();
				}

				app.processPage();

				jQuery('#content, #footer').stop(true, true).removeClass('ajaxifying');

				if (window.location.hash) {
					hash = window.location.hash;
				}

				if (hash) {
					require(['forum/topic'], function(topic) {
						topic.scrollToPost(hash.substr(1));
					});
				}

				app.refreshTitle(url);

			}, url, template);

			return true;
		}

		return false;
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

			if (this.getAttribute('data-ajaxify') === 'false') {
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

					if (config.useOutgoingLinksPage == true) {
						ajaxify.go('outgoing?url=' + encodeURIComponent(this.href));
						e.preventDefault();
					}
				}
			}
		});
	});

	function exec_body_scripts(body_el) {
		// modified from http://stackoverflow.com/questions/2592092/executing-script-elements-inserted-with-innerhtml

		function nodeName(elem, name) {
			return elem.nodeName && elem.nodeName.toUpperCase() === name.toUpperCase();
		}

		function evalScript(elem) {
			var data = (elem.text || elem.textContent || elem.innerHTML || ""),
				head = document.getElementsByTagName("head")[0] ||
					document.documentElement,
				script = document.createElement("script");

			script.type = "text/javascript";
			try {
				script.appendChild(document.createTextNode(data));
			} catch (e) {
				script.text = data;
			}

			if (elem.src) {
				script.src = elem.src;
			}

			head.insertBefore(script, head.firstChild);
			//TODO: remove from head before inserting?, doing this breaks scripts in safari so commented out for now
			//head.removeChild(script);
		}

		var scripts = [],
			script,
			children_nodes = $(body_el).find('script'),
			child,
			i;

		for (i = 0; children_nodes[i]; i++) {
			child = children_nodes[i];
			if (nodeName(child, "script") &&
				(!child.type || child.type.toLowerCase() === "text/javascript")) {
				scripts.push(child);
			}
		}

		for (i = 0; scripts[i]; i++) {
			script = scripts[i];
			if (script.parentNode) {
				script.parentNode.removeChild(script);
			}
			evalScript(scripts[i]);
		}
	}

}(jQuery));
