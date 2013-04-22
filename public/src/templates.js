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
	loadTemplates(['register', 'home', 'login', 'reset']);	
}

templates_init();