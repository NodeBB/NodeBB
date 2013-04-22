var fs = require('fs');

(function(Templates) {

	global.templates = {};

	function loadTemplates(templatesToLoad) {
		for (var t in templatesToLoad) {
			(function(template) {
				fs.readFile(global.configuration.ROOT_DIRECTORY + '/public/templates/' + template + '.tpl', function(err, html) {
					global.templates[template] = html;
				});
			}(templatesToLoad[t]));
		}
	}

	Templates.init = function() {
		loadTemplates(['header', 'footer', 'register', 'home', 'login', 'reset']);
	}

}(exports));