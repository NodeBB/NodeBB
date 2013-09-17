(function(module) {

	var config = {},
		templates,
		fs = null,
		available_templates = [],
		parsed_variables = {};

	module.exports = templates = {};

	try {
		fs = require('fs');
	} catch (e) {}

	templates.force_refresh = function(tpl) {
		return !!config.force_refresh[tpl];
	}

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

	templates.is_available = function(tpl) {
		return jQuery.inArray(tpl, available_templates) !== -1;
	};

	templates.ready = function(callback) {
		if (callback == null) {
			if (this.ready_callback) {
				this.ready_callback();
			} else {
				this.loaded = true;
			}
		} else {
			if (this.loaded == true) {
				callback();
			} else {
				this.ready_callback = callback;
			}
		}
	};

	templates.prepare = function(raw_tpl, data) {
		var template = {};
		template.html = raw_tpl;
		template.parse = parse;
		template.blocks = {};

		return template;
	};

	function loadTemplates(templatesToLoad) {
		function loadServer() {
			var loaded = templatesToLoad.length;

			for (var t in templatesToLoad) {
				(function(file) {
					fs.readFile(__dirname + '/../templates/' + file + '.tpl', function(err, html) {
						var template = function() {
							this.toString = function() {
								return this.html;
							};
						}

						template.prototype.file = file;
						template.prototype.parse = parse;
						template.prototype.html = String(html);

						global.templates[file] = new template;

						loaded--;
						if (loaded == 0) templates.ready();
					});
				}(templatesToLoad[t]));
			}
		}

		function loadClient() {
			jQuery.when(jQuery.getJSON(RELATIVE_PATH + '/templates/config.json'), jQuery.getJSON(RELATIVE_PATH + '/api/get_templates_listing')).done(function(config_data, templates_data) {
				config = config_data[0];
				available_templates = templates_data[0];
				templates.ready();
			});
		}

		if (fs === null) loadClient();
		else loadServer();
	}


	templates.init = function(templates_to_load) {
		loadTemplates(templates_to_load || []);
	}

	templates.getTemplateNameFromUrl = function(url) {
		var parts = url.split('?')[0].split('/');

		for (var i = 0; i < parts.length; ++i) {
			if (templates.is_available(parts[i])) {
				return parts[i];
			}
		}
		return '';
	}


	templates.load_template = function(callback, url, template) {
		var location = document.location || window.location,
			rootUrl = location.protocol + '//' + (location.hostname || location.host) + (location.port ? ':' + location.port : '');

		var api_url = (url === '' || url === '/') ? 'home' : url;

		var tpl_url = templates.get_custom_map(api_url.split('?')[0]);

		var trimmed = api_url;

		if (!tpl_url) {
			tpl_url = templates.getTemplateNameFromUrl(api_url);
		}

		var template_data = null;


		(function() {
			var timestamp = new Date().getTime(); //debug

			if (!templates[tpl_url]) {
				jQuery.get(RELATIVE_PATH + '/templates/' + tpl_url + '.tpl?v=' + timestamp, function(html) {
					var template = function() {
						this.toString = function() {
							return this.html;
						};
					}

					template.prototype.parse = parse;
					template.prototype.html = String(html);
					template.prototype.blocks = {};

					templates[tpl_url] = new template;

					parse_template();
				});
			} else {
				parse_template();
			}

		}());

		(function() {

			jQuery.get(API_URL + api_url, function(data) {

				if (!data) {
					ajaxify.go('404');
					return;
				}

				template_data = data;
				parse_template();
			}).fail(function(data) {
				template_data = {};
				parse_template();
			});
		}());


		function parse_template() {
			if (!templates[tpl_url] || !template_data) return;

			if (typeof global !== "undefined")
				template_data['relative_path'] = nconf.get('relative_path');
			else
				template_data['relative_path'] = RELATIVE_PATH;

			document.getElementById('content').innerHTML = templates[tpl_url].parse(template_data);

			jQuery('#content [template-variable]').each(function(index, element) {
				var value = null;

				switch (element.getAttribute('template-type')) {
					case 'boolean':
						value = (element.value === 'true' || element.value === '1') ? true : false;
						break;
					case 'int': // Intentional fall-through
					case 'integer':
						value = parseInt(element.value);
						break;
					default:
						value = element.value;
						break;
				}

				templates.set(element.getAttribute('template-variable'), value);
			});

			if (callback) {
				callback(true);
			}
		}

	}

	templates.flush = function() {
		parsed_variables = {};
	}

	templates.get = function(key) {
		return parsed_variables[key];
	}

	templates.set = function(key, value) {
		parsed_variables[key] = value;
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

			if (self.blocks && block !== undefined) self.blocks[block] = data[0];

			data = data[0]
				.replace("<!-- BEGIN " + block + " -->", "")
				.replace("<!-- END " + block + " -->", "");

			return data;
		}

		function setBlock(regex, block, template) {
			return template.replace(regex, block);
		}

		var template = this.html,
			regex, block;

		return (function parse(data, namespace, template) {
			if (!data || data.length == 0) {
				template = '';
			}

			for (var d in data) {
				if (data.hasOwnProperty(d)) {
					if (data[d] === null) {
						template = replace(namespace + d, '', template);
					} else if (data[d].constructor == Array) {
						namespace += d + '.';

						var regex = makeRegex(d),
							block = getBlock(regex, namespace.substring(0, namespace.length - 1), template);

						if (block == null) {
							namespace = namespace.replace(d + '.', '');
							continue;
						}

						var numblocks = data[d].length - 1,
							i = 0,
							result = "";

						do {
							result += parse(data[d][i], namespace, block);
						} while (i++ < numblocks);

						namespace = namespace.replace(d + '.', '');
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

	if ('undefined' !== typeof window) {
		window.templates = module.exports;
		templates.init();
	}

})('undefined' === typeof module ? {
	module: {
		exports: {}
	}
} : module)