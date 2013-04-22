var ajaxify = {};


(function($) {
	
	var rootUrl = document.location.protocol + '//' + (document.location.hostname || document.location.host) + (document.location.port ? ':'+document.location.port : ''),
		content = null;

	var current_state = '';

	ajaxify.go = function(url) {
		var tpl_url = (url === '') ? 'home' : url;

		if (templates[tpl_url]) {
			if (current_state != url) {
				current_state = url;

				window.history.pushState({}, url, "/" + url);
				content.innerHTML = templates[tpl_url];
				exec_body_scripts(content);

				
			}
			
			return true;
		}

		return false;
	}

	$('document').ready(function() {
		if (!window.history || !window.history.pushState) return; // no ajaxification for old browsers
		

		content = content || document.getElementById('content');

		$('a').unbind('click').bind('click', function(ev) {
			var url = this.href.replace(rootUrl +'/', '');

			if (ajaxify.go(url)) {
				ev.preventDefault();
				return false;
			} 
			
			
		});
	});

	function exec_body_scripts(body_el) {
		//http://stackoverflow.com/questions/2592092/executing-script-elements-inserted-with-innerhtml
		// Finds and executes scripts in a newly added element's body.
		// Needed since innerHTML does not run scripts.
		//
		// Argument body_el is an element in the dom.

		function nodeName(elem, name) {
		return elem.nodeName && elem.nodeName.toUpperCase() ===
		          name.toUpperCase();
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