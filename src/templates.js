var fs = require('fs');

(function(Templates) {

	global.templates = {};

	function loadTemplates(templatesToLoad) {
		for (var t in templatesToLoad) {
			(function(file) {
				fs.readFile(global.configuration.ROOT_DIRECTORY + '/public/templates/' + file + '.tpl', function(err, html) {
					var template = function() {
						this.toString = function() {
							return this.html;
						};
					}

					template.prototype.parse = parse;
					template.prototype.html = String(html);
					
					global.templates[file] = new template;
				});
			}(templatesToLoad[t]));
		}
	}

	Templates.init = function() {
		loadTemplates([
			'header', 'footer', 'register', 'home',
			'login', 'reset', 'reset_code', 'account_settings',
			'emails/reset', 'emails/reset_plaintext'
		]);
	}

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

			for (var d in data) {
				if (data.hasOwnProperty(d)) {
					if (data[d] instanceof String) {
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

}(exports));