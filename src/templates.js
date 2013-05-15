var fs = require('fs');


// to be deprecated in favour of client-side only templates.

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

					template.prototype.file = file;
					template.prototype.parse = parse;
					template.prototype.html = String(html);
					
					global.templates[file] = new template;
				});
			}(templatesToLoad[t]));
		}
	}

	Templates.init = function() {
		loadTemplates([
			'header', 'footer', 'register', 'home', 'topic', 'account', 'friends',
			'login', 'reset', 'reset_code', 'logout',
			'403',
			'admin/header', 'admin/footer', 'admin/index',
			'emails/header', 'emails/footer',
			'emails/reset', 'emails/reset_plaintext', 'emails/email_confirm', 'emails/email_confirm_plaintext'
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
			console.log(this.file + ' is being called on server side. Templates will be deprecated soon');
			if (Object.keys(data).length == 0) {
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

}(exports));