var ajaxify = {};


(function($) {
	
	var location = document.location || window.location,
		rootUrl = location.protocol + '//' + (location.hostname || location.host) + (location.port ? ':' + location.port : ''),
		content = null;

	var current_state = null;
	var executed = {};

	var events = [];
	ajaxify.register_events = function(new_page_events) {
		for (var i = 0, ii = events.length; i<ii; i++) {
			socket.removeAllListeners(events[i]); // optimize this to user removeListener(event, listener) instead.
		}

		events = new_page_events;
	};


	window.onpopstate = function(event) {
		if (event !== null && event.state && event.state.url !== undefined) ajaxify.go(event.state.url, null, null, true);
	};

	ajaxify.go = function(url, callback, template, quiet) {
		// "quiet": If set to true, will not call pushState

		// leave room and join global
		app.enter_room('global');

		var url = url.replace(/\/$/, "");

		var tpl_url = templates.get_custom_map(url);
		
		if (tpl_url == false && !templates[url]) {
			tpl_url = (url === '' || url === '/') ? 'home' : url.split('/')[0];
		} else if (templates[url]) {
			tpl_url = url;
		}
		
		if (templates[tpl_url]) {
			if (quiet !== true) {
				window.history.pushState({
					"url": url
				}, url, "/" + url);
			}

			jQuery('#footer').fadeOut(100);
			jQuery('#content').fadeOut(100);

			load_template(function() {
				exec_body_scripts(content);

				ajaxify.enable();
				if (callback) {
					callback();
				}
				
				jQuery('#content, #footer').fadeIn(200);
			}, url, template);
			
			
			return true;
		}

		return false;
	}

	ajaxify.enable = function() {
		$('a').unbind('mouseup', ajaxify.onmouseup).bind('mouseup', ajaxify.onmouseup);
		$('a').unbind('click', ajaxify.onclick).bind('click', ajaxify.onclick);
	}

	ajaxify.onmouseup = function(ev) {
		if (this.href == window.location.href + "#") return;
		var url = this.href.replace(rootUrl +'/', '');

		if (!ev.ctrlKey && ev.which === 1) {
			if (ajaxify.go(url)) ev.preventDefault();
		} else if ((ev.ctrlKey && ev.which === 1) || ev.which === 2) {
			window.open(this.href, '_blank');
			ev.preventDefault();
		}
	}

	ajaxify.onclick = function(ev) {
		ev.preventDefault();
	}

	$('document').ready(function() {
		if (!window.history || !window.history.pushState) return; // no ajaxification for old browsers

		content = content || document.getElementById('content');

		ajaxify.enable();
	});

	function exec_body_scripts(body_el) {
		//http://stackoverflow.com/questions/2592092/executing-script-elements-inserted-with-innerhtml
		// Finds and executes scripts in a newly added element's body.
		// Needed since innerHTML does not run scripts.
		//
		// Argument body_el is an element in the dom.

		function nodeName(elem, name) {
			return elem.nodeName && elem.nodeName.toUpperCase() === name.toUpperCase();
		};

		function evalScript(elem) {
			var data = (elem.text || elem.textContent || elem.innerHTML || "" ),
			    head = document.getElementsByTagName("head")[0] ||
			              document.documentElement,
			    script = document.createElement("script");

			script.type = "text/javascript";
			try {
			  // doesn't work on ie...
			  script.appendChild(document.createTextNode(data));      
			} catch(e) {
			  // IE has funky script nodes
			  script.text = data;
			}

			head.insertBefore(script, head.firstChild);
			head.removeChild(script);
		};

		// main section of function
		var scripts = [],
		  script,
		  children_nodes = body_el.childNodes,
		  child,
		  i;

		for (i = 0; children_nodes[i]; i++) {
		child = children_nodes[i];
		if (nodeName(child, "script" ) &&
		  (!child.type || child.type.toLowerCase() === "text/javascript")) {
		      scripts.push(child);
		  }
		}

		for (i = 0; scripts[i]; i++) {
			script = scripts[i];
			if (script.parentNode) {script.parentNode.removeChild(script);}
			evalScript(scripts[i]);
		}
	};
	
}(jQuery));