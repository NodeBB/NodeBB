<!DOCTYPE html>
<html>
<head>
	<title></title>
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<link href="vendor/bootstrap/css/bootstrap.min.css" rel="stylesheet" media="screen">
	<script type="text/javascript" src="http://code.jquery.com/jquery.js"></script>
	<script type="text/javascript" src="vendor/bootstrap/js/bootstrap.min.js"></script>
	<script type="text/javascript" src="socket.io/socket.io.js"></script>
	<script type="text/javascript">
		(function($) {
			var templates = {};

			function loadTemplates(templatesToLoad) {
				var timestamp = new Date().getTime();

				for (var t in templatesToLoad) {
					(function(template) {
						$.get('templates/' + template + '.tpl?v=' + timestamp, function(html) {
							templates[template] = html;
						});
					}(templatesToLoad[t]));
				}
			}

			function templates_init() {
				loadTemplates(['register', 'home', 'login']);	
			}

			templates_init();

			var rootUrl = document.location.protocol + '//' + (document.location.hostname || document.location.host) + (document.location.port ? ':'+document.location.port : ''),
				content = null;
				console.log(rootUrl);
			$('document').ready(function() {
				if (!window.history || !window.history.pushState) return; // no ajaxification for old browsers
				

				content = content || document.getElementById('content');

				$('a').unbind('click').bind('click', function(ev) {
					var url = this.href.replace(rootUrl +'/', '');
					var tpl_url = (url === '') ? 'home' : url;

					if (templates[tpl_url]) {
						window.history.pushState({}, url, "/" + url);
						content.innerHTML = templates[tpl_url];
						exec_body_scripts(content);
					} 
					
					ev.preventDefault();
					return false;
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
	</script>
	<style type="text/css">
      body {
        padding-top: 60px;
      }
	</style>
	<script>
	var socket = io.connect('http://198.199.80.41:8081');

	socket.on('event:connect', function(data) {
		
	});


	</script>
</head>

<body>
	<div class="navbar navbar-inverse navbar-fixed-top">
      <div class="navbar-inner">
        <div class="container">
        	<div class="nav-collapse collapse">
	            <ul class="nav">
	              <li class="active"><a href="/">Home</a></li>
	              <li><a href="/register">Register</a></li>
	              <li><a href="/login">Login</a></li>
	            </ul>
	        </div>
        </div>
      </div>
    </div>

    <div class="container" id="content">

