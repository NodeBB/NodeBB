module.exports = (grunt) ->

  grunt.initConfig
    coffee:
      public:
        options:
          bare: true
        expand: true
        cwd: "public/"
        src: ["**/*.coffee"]
        dest: "public/"
        ext: ".js"
      server:
        options:
          bare: true
        expand: true
        cwd: "src/"
        src: ["**/*.coffee"]
        dest: "src/"
        ext: ".js"

  grunt.loadNpmTasks 'grunt-contrib-coffee'

  grunt.registerTask "default", ["coffee:public", "coffee:server"]