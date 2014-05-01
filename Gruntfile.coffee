# npm install grunt grunt-contrib-coffee grunt-jsbeautifier coffee grunt-coffee

module.exports = (grunt) ->

  grunt.initConfig
    coffee:
      public:
        options:
          bare: true
        expand: true
        cwd: "public/src/"
        src: ["**/*.coffee"]
        dest: "public/src/"
        ext: ".js"
      server:
        options:
          bare: true
        expand: true
        cwd: "src/"
        src: ["**/*.coffee"]
        dest: "src/"
        ext: ".js"
    jsbeautifier:
      files: ["public/src/**/*.js", "src/**/*.js"]
      options:
        config: '.jsbeautifyrc'
        jsbeautifyrc: true # should work without config-option, but doesn't...

  grunt.loadNpmTasks 'grunt-contrib-coffee'
  grunt.loadNpmTasks 'grunt-jsbeautifier'

  grunt.registerTask "default", ["coffee:public", "coffee:server", "jsbeautifier"]