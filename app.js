var modules = {
    	user: require('./src/user.js'),
        topics: require('./src/topics.js'),
        posts: require('./src/posts.js'),
    	templates: require('./src/templates.js'),
    	webserver: require('./src/webserver.js'),
    	websockets: require('./src/websockets.js')
    }

    DEVELOPMENT = true;


global.configuration = {};
global.modules = modules;

// change this to = null when auth module is complete
// global.uid = 1;



(function(config) {
    config['ROOT_DIRECTORY'] = __dirname;

	modules.templates.init();
	modules.webserver.init();
	modules.websockets.init();
	


}(global.configuration));