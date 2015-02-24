module.exports = function(grunt) {
	grunt.initConfig({
		less: {
			development: {
				files: {
					'public/bin/manifest.css': 'source/manifest.less'
				}
			}
		},
		watch: {
			lessUpdated: {
				files: 'public/**/*.less'
			},
			clientUpdated: {
				files: 'public/src/**/*.js'
			},
			serverUpdated: {
				files: ['*.js', 'src/**/*.js']
			},
			templatesUpdated: {
				files: ['src/views/**/*.tpl', 'node_modules/nodebb-*/**/*.tpl']
			}
		}
	});

	grunt.loadNpmTasks('grunt-contrib-watch');

	grunt.registerTask('default', ['watch']);

	var fork = require('child_process').fork,
		env = process.env;

	process.env.NODE_ENV = 'development'

	var worker = fork('app.js', ['--log-level=info'], {
		env: env,
		silent: false
	});


	grunt.event.on('watch', function(action, filepath, target) {
		var args = [];
		
		if (target === 'lessUpdated') {
			args.push('--from-file=js,tpl');
		} else if (target === 'clientUpdated') {
			args.push('--from-file=less,tpl');
		} else if (target === 'templatesUpdated') {
			args.push('--from-file=js,less');
		} else if (target === 'serverUpdated') {
			args.push('--from-file=less,js,tpl');
		}

		args.push('--log-level=info');

		worker.kill();
		worker = fork('app.js', args, {
			env: env,
			silent: false
		});
	});

};