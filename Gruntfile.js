module.exports = function(grunt) {
	grunt.initConfig({
		pkg: grunt.file.readJSON('package.json'),
		express: {
			dev: {
				options: {
					script: 'app.js',
					node_env: 'development',
					args: ['dev', 'from-file'],
					output: "NodeBB Ready"
				}
			},
			minifyJS: {
				options: {
					script: 'app.js',
					node_env: 'development',
					args: ['dev', 'minify-js'],
					output: "NodeBB Ready"
				}
			},
			compileLESS: {
				options: {
					script: 'app.js',
					node_env: 'development',
					args: ['dev', 'compile-less'],
					output: "NodeBB Ready"
				}
			}
		},
		less: {
			development: {
				files: {
					"public/bin/manifest.css": "source/manifest.less"
				}
			}
		},
		watch: {
			compileLESS: {
				files: "**/*.less",
				tasks: ['express:compileLESS'],
				options: {
					livereload: true,
				}
			}
		}
	});

	grunt.loadNpmTasks('grunt-contrib-watch');
	grunt.loadNpmTasks('grunt-express-server');

	grunt.registerTask('default', ['express:dev', 'watch']);

	grunt.event.on('watch', function(action, filepath, target) {
		grunt.log.writeln(target + ': ' + filepath + ' has ' + action);
	});
};