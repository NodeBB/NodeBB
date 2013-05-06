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

                modules.categories.create({
                    'name': 'General',
                    'description': 'A place to talk about whateeeever you want'
                });


                modules.categories.create({
                    'name': 'NodeBB Development',
                    'description': 'Bugs? Dont worry, we dont read this thread, so post them here.'
                });


                modules.categories.create({
                    'name': 'Design Create Play',
                    'description': 'In future an example of how a hidden category should look like.'
                });

            } else console.log('Good.');
        });
    }


    setup_categories();

}(global.configuration));