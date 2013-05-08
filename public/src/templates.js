var templates = {};

(function() {
	var ready_callback,
		config = {};

	templates.get_custom_map = function(tpl) {
		if (config['custom_mapping'] && tpl) {
			for (var pattern in config['custom_mapping']) {
				if (tpl.match(pattern)) {
					return (config['custom_mapping'][pattern]);
				}
			}
		}
		return false;
	}

	templates.ready = function(callback) {
		//quick implementation because introducing a lib to handle several async callbacks
		if (callback == null && ready_callback) ready_callback();
		else ready_callback = callback;
	};

	templates.prepare = function(raw_tpl, data) {
		var template = {};
		template.html = raw_tpl;
		template.parse = parse;
		template.blocks = {};
		return template; 		
	};

	function loadTemplates(templatesToLoad) {
		var timestamp = new Date().getTime();
		var loaded = templatesToLoad.length;

		$.getJSON('/templates/config.json', function(data) {
			config = data;
		});

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
					template.prototype.blocks = {};

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
			'header', 'footer', 'register', 'home', 'topic','account', 'category', 'users', 'accountedit', 
			'login', 'reset', 'reset_code', 'account',
			'confirm',
			'emails/reset', 'emails/reset_plaintext', 'emails/email_confirm', 'emails/email_confirm_plaintext'
		]);
	}


	//modified from https://github.com/psychobunny/dcp.templates
	var parse = function(data) {
		var self = this;

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

			if (block !== undefined) self.blocks[block] = data[0];

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
			if (!data || data.length == 0) {
				template = '';
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

			if (namespace) {
				var regex = new RegExp("{" + namespace + "[^]*?}", 'g');
				template = template.replace(regex, '');
			}

			return template;
			
		})(data, "", template);
	}


	init();

}());

function load_template(callback, custom_tpl) {
	var location = document.location || window.location,
		rootUrl = location.protocol + '//' + (location.hostname || location.host) + (location.port ? ':' + location.port : '');

	var url = location.href.replace(rootUrl +'/', '');
	url = (url === '' || url === '/') ? 'home' : url;


	jQuery.get(API_URL + url, function(data) {
		var tpl = templates.get_custom_map(url);
		if (tpl == false) {
			tpl = url.split('/')[0];
		}

		if (custom_tpl && custom_tpl != "undefined") 
			tpl = custom_tpl;


		document.getElementById('content').innerHTML = templates[tpl].parse(JSON.parse(data));
		if (callback) callback();
	});
}