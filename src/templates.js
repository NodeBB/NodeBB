var fs = require('fs');

(function(Templates) {

	global.templates = {};

	function loadTemplates(templatesToLoad) {
		for (var t in templatesToLoad) {
			(function(template) {
				console.log(global.configuration.ROOT_DIRECTORY);
				fs.readFile(global.configuration.ROOT_DIRECTORY + '/public/templates/' + template + '.tpl', function(err, html) {
					global.templates[template] = html;
					console.log(html);
				});
			}(templatesToLoad[t]));
		}
	}

	Templates.init = function() {
		loadTemplates(['header', 'footer', 'register', 'home']);
	}

}(exports));