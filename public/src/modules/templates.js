define('templates', function() {
	var Templates = {};

	Templates.refresh = function(callback) {
		$.getJSON(RELATIVE_PATH + '/api/get_templates_listing', function (data) {
			Templates.config = data.templatesConfig;
			Templates.available = data.availableTemplates;

			if (callback) callback();
		});
	};

	return Templates;
});