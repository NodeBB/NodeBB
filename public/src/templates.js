var templates = {};

(function() {
	var ready_callback;

	templates.ready = function(callback) {
		//quick implementation because introducing a lib to handle several async callbacks
		if (callback == null && ready_callback) ready_callback();
		else ready_callback = callback;
	}

	function loadTemplates(templatesToLoad) {
		var timestamp = new Date().getTime();
		var loaded = templatesToLoad.length;

		for (var t in templatesToLoad) {
			(function(file) {
				$.get('/templates/' + file + '.tpl?v=' + timestamp, function(html) {
					var template = function() {
						this.toString = function() {
							return this.html;
						};
					}

					template.prototype.parse = parse;
					template.prototype.html = String(html);
					
					templates[file] = new template;

					loaded--;
					if (loaded == 0) templates.ready();
				}).fail(function() {
					loaded--;
					if (loaded == 0) templates.ready();
				});
			}(templatesToLoad[t]));
		}
	}


	function init() {
		loadTemplates([
				'header', 'footer', 'register', 'home', 'topic',
				'login', 'reset', 'reset_code',
				'emails/reset', 'emails/reset_plaintext'
			]);
	}


	//modified from https://github.com/psychobunny/dcp.templates
	var parse = function(data) {
		function replace(key, value, template) {
			var searchRegex = new RegExp('{' + key + '}', 'g');
			return template.replace(searchRegex, value);
		}

		function makeRegex(block) {
			return new RegExp("<!-- BEGIN " + block + " -->[^]*<!-- END " + block + " -->", 'g');
		}

		function getBlock(regex, block, template) {
			data = template.match(regex);			
			if (data == null) return;

			data = data[0]
				.replace("<!-- BEGIN " + block + " -->", "")
				.replace("<!-- END " + block + " -->", "");

			return data;
		}

		function setBlock(regex, block, template) {
			return template.replace(regex, block);
		}

		var template = this.html, regex, block;

		return (function parse(data, namespace, template) {
			if (data.length == 0) {
				regex = makeRegex('[^]*');
				template = template.replace(regex, '');
			}

			for (var d in data) {
				if (data.hasOwnProperty(d)) {
					if (data[d] instanceof String || data[d] === null) {
						continue;
					} else if (data[d].constructor == Array) {
						namespace += d;
						
						regex = makeRegex(d),
						block = getBlock(regex, namespace, template)
						if (block == null) continue;

						var numblocks = data[d].length - 1, i = 0, result = "";

						do {
							result += parse(data[d][i], namespace + '.', block);
						} while (i++ < numblocks);
						
						template = setBlock(regex, result, template);
						
					} else if (data[d] instanceof Object) {
						namespace += d + '.';
						
						regex = makeRegex(d),
						block = getBlock(regex, namespace, template)
						if (block == null) continue;

						block = parse(data[d], namespace, block);
						template = setBlock(regex, block, template);
					} else {								
						template = replace(namespace + d, data[d], template);
					}
				}					
			}

			return template;
			
		})(data, "", template);
	}


	init();

}());

function load_template(callback) {
	var location = document.location || window.location,
		rootUrl = location.protocol + '//' + (location.hostname || location.host) + (location.port ? ':' + location.port : '');

	var url = location.href.replace(rootUrl +'/', '');
	url = (url === '' || url === '/') ? 'home' : url;

	jQuery.get(API_URL + url, function(data) {
		document.getElementById('content').innerHTML = templates[url.split('/')[0]].parse(JSON.parse(data));
		if (callback) callback();
	});
}