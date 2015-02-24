module.exports = function(grunt) {
	grunt.initConfig({
		pkg: grunt.file.readJSON('package.json'),
		express: {
			dev: {
				options: {
					script: 'app.js',
					node_env: 'development',
					args: ['--log-level=info'],
					output: 'NodeBB Ready',
					interrupt: true,
					spawn: false,
					interval: 100
				}
			},
			serverUpdated: {
				options: {
					script: 'app.js',
					node_env: 'development',
					args: ['--from-file=less,js', '--log-level=info'],
					output: 'NodeBB Ready',
					interrupt: true,
					spawn: false,
					interval: 100
				}
			},
			clientUpdated: {
				options: {
					script: 'app.js',
					node_env: 'development',
					args: ['--from-file=less', '--log-level=info'],
					output: 'NodeBB Ready',
					interrupt: true,
					spawn: false,
					interval: 100
				}
			},
			lessUpdated: {
				options: {
					script: 'app.js',
					node_env: 'development',
					args: ['--from-file=js', '--log-level=info'],
					output: 'NodeBB Ready',
					interrupt: true,
					spawn: false,
					interval: 100
				}
			}
		},
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
				tasks: ['express:lessUpdated']
			},
			clientUpdated: {
				files: 'public/src/**/*.js',
				tasks: ['express:clientUpdated']
			},
			serverUpdated: {
				files: ['*.js', 'src/**/*.js'],
				tasks: ['express:serverUpdated']
			}
		}
	});

	grunt.loadNpmTasks('grunt-contrib-watch');
	grunt.loadNpmTasks('grunt-express-server');

	grunt.registerTask('default', ['express:dev', 'watch']);
};