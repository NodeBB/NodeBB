


var winston = require('winston');

process.on('uncaughtException', function (err) {
	winston.error('Encountered error while running test suite: ' + err.message);
});

var	assert = require('assert'),
	RDB = require('../mocks/redismock');

// Reds is not technically used in this test suite, but its invocation is required to stop the included
// libraries from trying to connect to the default Redis host/port
var reds = require('reds');
reds.createClient = function () {
	return reds.client || (reds.client = RDB);
};

var Topics = require('../src/topics');

describe('Topics', function() {
	var	newTopic;
	var newPost;
	var userInfo;

	describe('.post', function() {
		it('should post a new topic', function(done) {
			var uid = 1,
				cid = 1,
				title = 'Test Topic Title',
				content	= 'The content of test topic';

			Topics.post(uid, title, content, cid, function(err, result) {
				assert.equal(err, null, 'was created with error');
				assert.ok(result);

				newTopic = result.topicData;
				newPost = result.postData;

				done();
			});
		});

		it('should fail posting a topic', function(done) {
			var uid = null,
				cid = 1,
				title = 'Test Topic Title',
				content	= 'The content of test topic';

			Topics.post(uid, title, content, cid, function(err, result) {
				assert.equal(err.message, 'not-logged-in');
				done();
			});
		});
	});

	describe('.getTopicData', function() {
		it('should get Topic data', function(done) {
			Topics.getTopicData(newTopic.tid, function(err, result) {
				done.apply(this.arguments);
			});
		});
	});


	describe('.getTopicDataWithUser', function() {
		it('should get Topic data with user info', function(done) {
			Topics.getTopicDataWithUser(newTopic.tid, function(err, result) {

				done.apply(this.arguments);
			});
		});
	});


	after(function() {
		RDB.send_command('flushdb', [], function(error){
			if(error){
				winston.error(error);
				throw new Error(error);
			}
		});
	});
});