module.exports = function(grunt) {
	grunt.initConfig({
		pkg: grunt.file.readJSON('package.json'),
		execute: {
			dev: {
				src: 'a.js',
				options: {
					args: ['arg']
				}
			},
			minifyJS: {
				src: 'app.js',
				options: {
					args: ['from-file']
				}
			},
			minifyCSS: {
				src: 'app.js',
				options: {
					args: ['from-file']
				}
			},
		},
		watch: {
			clientScripts: {
				files:  ['public/src/**/*.js'],
				tasks:  ['execute:minifyJS'],
				options: {
					spawn: false
				}
			},
			serverScripts: {
				files:  ['*.js', 'src/**/*.js', 'node_modules/**/*.js'],
				tasks:  ['execute:minifyCSS'],
				options: {
					spawn: false
				}
			},
			less: {
				files:  ['**/*.less'],
				tasks:  ['execute:minifyCSS'],
				options: {
					spawn: false
				}
			}
		}
	});

	grunt.loadNpmTasks('grunt-contrib-watch');
	grunt.loadNpmTasks('grunt-execute');

	grunt.registerTask('default', ['watch', 'execute:minifyCSS']);
};