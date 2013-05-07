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
                    'name': 'Announcements',
                    'description': 'A place to talk about whateeeever you want',
                    'blockclass': 'category-purple',
                    'icon' : 'icon-bullhorn'
                });

                modules.categories.create({
                    'name': 'General Discussion',
                    'description': 'A place to talk about whateeeever you want',
                    'blockclass': 'category-purple',
                    'icon' : 'icon-comment'
                });


                modules.categories.create({
                    'name': 'NodeBB Development',
                    'description': 'Bugs? Dont worry, we dont read this thread, so post them here.',
                    'blockclass': 'category-purple',
                    'icon' : 'icon-github-alt'
                });


                modules.categories.create({
                    'name': 'Blogs',
                    'description': 'In future an example of how a hidden category should look like.',
                    'blockclass': 'category-purple',
                    'icon' : 'icon-pencil'
                });

            } else console.log('Good.');
        });
    }


    setup_categories();

}(global.configuration));