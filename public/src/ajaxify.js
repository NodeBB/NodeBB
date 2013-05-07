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
		// this breaks reloading and results in ajaxify.go calling twice, believe it messes around with sockets. ill come back for you later bitchez
		// ajaxify.go(document.location.href.replace(rootUrl +'/', ''));
	};

	ajaxify.go = function(url, callback) {

		// leave room and join global
		app.enter_room('global');

		var url = url.replace(/\/$/, "");
		var tpl_url = (url === '' || url === '/') ? 'home' : url.split('/')[0];
		tpl_url = templates.get_custom_map(tpl_url);
		
		if (templates[tpl_url]) {
			window.history.pushState({}, url, "/" + url);

			jQuery('#footer').fadeOut(100);
			jQuery('#content').fadeOut(100);

			load_template(function() {
				console.log('called');
				exec_body_scripts(content);

				ajaxify.enable();
				if (callback) {
					callback();
				}
				
				jQuery('#content, #footer').fadeIn(250);
			});
			
			
			return true;
		}

		return false;
	}

	ajaxify.enable = function() {
		$('a').unbind('click', ajaxify.onclick).bind('click', ajaxify.onclick);
	}

	ajaxify.onclick = function(ev) {
		if (this.href == window.location.href + "#") return;
		var url = this.href.replace(rootUrl +'/', '');

		if (ajaxify.go(url)) {
			ev.preventDefault();
			// return false;	// Uncommenting this breaks event bubbling!
		}
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