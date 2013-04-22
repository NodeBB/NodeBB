var modules = {
    	user: require('./src/user.js'),
    	templates: require('./src/templates.js'),
    	webserver: require('./src/webserver.js'),
    	websockets: require('./src/websockets.js')
    }

    DEVELOPMENT = true;


global.configuration = {};
global.modules = modules;




(function(config) {
    config['ROOT_DIRECTORY'] = __dirname;

	modules.templates.init();
	modules.webserver.init();
	modules.websockets.init();
	


}(global.configuration));