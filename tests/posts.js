'use strict';
/*global require*/

var assert = require('assert');
var posts = require('../src/posts.js');
var plugins = require('../src/plugins.js')

describe('Posts', function(){
  describe('.parsePost()', function(done) {
    it('should escape posts', function(done) {
      var postData = {
        pid : 123,
        content: "Something fine, [[something:bad]]."
      };

      posts.parsePost(postData, function (err, data) {
        assert.strictEqual(data.content, "Something fine, [&#8203;[something:bad]&#8203;].");
        done();
      });
    });
  });

  it('should not escape post content that a plugin adds', function (done) {
    var hookData = {
      hook: "filter:parse.post",
      method: function (data, callback) {
        // if this condition isn't put in, then
        // it'll add it to all posts; making it
        // specific to this exact string makes it
        // ad hoc
        if (data.postData.content == "Where we're going: ") {
          data.postData.content += "[[global:home]]";
        }

        callback(null, data);
      }
    };

    plugins.registerHook(0, hookData, function () {
      var postData = {
        pid : 123,
        content: "Where we're going: "
      };

      posts.parsePost(postData, function (err, data) {
        // it should return the key because this is pre-translation
        assert.strictEqual(data.content, "Where we're going: [[global:home]]");
        done();
      });
    });
  });
});
