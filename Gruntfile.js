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
				files: 'public/**/*.less',
				/*tasks: ['express:lessUpdated']*/
			},
			clientUpdated: {
				files: 'public/src/**/*.js',
				/*tasks: ['express:clientUpdated']*/
			},
			serverUpdated: {
				files: ['*.js', 'src/**/*.js'],
				/*tasks: ['express:serverUpdated']*/
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
		silent: true
	});


	grunt.event.on('watch', function(action, filepath, target) {
		var args = [];
		
		if (target === 'lessUpdated') {
			args.push('--from-file=js');
		} else if (target === 'clientUpdated') {
			args.push('--from-file=less');
		} else if (target === 'serverUpdated') {
			args.push('--from-file=less,js');
		}

		args.push('--log-level=info');

		worker.kill();
		worker = fork('app.js', args, {
			env: env,
			silent: true
		});
	});

};