var modules = {
    	user: require('./src/user.js'),
        topics: require('./src/topics.js'),
        posts: require('./src/posts.js'),
        categories: require('./src/categories.js'),
    	templates: require('./src/templates.js'),
    	webserver: require('./src/webserver.js'),
    	websockets: require('./src/websockets.js'),
        fs: require('fs')
    }

    DEVELOPMENT = true;


global.configuration = {};
global.modules = modules;


(function(config) {
    config['ROOT_DIRECTORY'] = __dirname;

	modules.templates.init();
	modules.websockets.init();
	


    //setup scripts to be moved outside of the app in future.
    function setup_categories() {
        console.log('Checking categories...');
        modules.categories.get(function(data) {
            if (data.categories.length === 0) {
                console.log('Setting up default categories...');

                modules.fs.readFile(config.ROOT_DIRECTORY + '/install/data/categories.json', function(err, categories) {
                    categories = JSON.parse(categories);
                    
                    for (var category in categories) {
                        modules.categories.create(categories[category]);
                    }
                });

            } else console.log('Good.');
        });
    }


    setup_categories();

}(global.configuration));