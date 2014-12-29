var	assert = require('assert'),
	db = require('./mocks/databasemock'),
	async = require('async');


describe('Test database', function() {
	it('should work', function(){
		assert.doesNotThrow(function(){
			var db = require('./mocks/databasemock');
		});
	});

	require('./database/keys');
	require('./database/list');
	require('./database/sets');

	it('should not throw err', function(done) {
		var objectKey = 'testObj';

		function setObject(callback) {
			db.setObject(objectKey, {name:'baris', 'lastname':'usakli', age:3}, function(err, result) {
				callback(err, {'setObject':result});
			});
		}

		function getObject(callback) {
			db.getObject(objectKey, function(err, data) {
				callback(err, {'getObject':data});
			});
		}

		function getObjects(callback) {
			db.getObjects(['testing1', objectKey, 'doesntexist', 'user:1'], function(err, data) {
				callback(err, {'getObjects':data});
			});
		}

		function setObjectField(callback) {
			db.setObjectField(objectKey, 'reputation', 5, function(err, result) {
				callback(err, {'setObjectField': result});
			});
		}

		function getObjectField(callback) {
			db.getObjectField(objectKey, 'age', function(err, age) {
				callback(err, {'getObjectField' : age});
			});
		}

		function getObjectFields(callback) {
			db.getObjectFields(objectKey, ['name', 'lastname'], function(err, data) {
				callback(err, {'getObjectFields':data});
			});
		}

		function getObjectValues(callback) {
			db.getObjectValues(objectKey, function(err, data) {
				callback(err, {'getObjectValues':data});
			});
		}

		function isObjectField(callback) {
			db.isObjectField(objectKey, 'age', function(err, data) {
				callback(err, {'isObjectField':data});
			});
		}

		function deleteObjectField(callback) {
			db.deleteObjectField(objectKey, 'reputation', function(err, data) {
				callback(err, {'deleteObjectField':data});
			});
		}

		function incrObjectFieldBy(callback) {
			db.incrObjectFieldBy(objectKey, 'age', 3, function(err, data) {
				callback(err, {'incrObjectFieldBy':data});
			});
		}

		function getObjectKeys(callback) {
			db.getObjectKeys(objectKey, function(err, data) {
				callback(err, {'getObjectKeys':data});
			});
		}

		var objectTasks = [
			setObject,
			getObject,
			deleteObjectField,
			getObject,
			setObjectField,
			getObject,
			deleteObjectField,
			getObject,
			getObjectField,
			getObjectFields,
			getObjectValues,
			isObjectField,
			incrObjectFieldBy,
			getObject,
			getObjects,
			getObjectKeys
		];

		async.series(objectTasks, function(err, results) {
			assert.equal(err, null, 'error in object methods');
			assert.ok(results);

			done();
		});
	});


	it('should not throw err', function(done) {
		function sortedSetAdd(callback) {
			db.sortedSetAdd('sortedSet3', 12, 5, function(err) {
				callback(err);
			});
		}

		function sortedSetRemove(callback) {
			db.sortedSetRemove('sortedSet3', 12, function(err, data) {
				callback(err);
			});
		}

		function getSortedSetRange(callback) {
			db.getSortedSetRange('sortedSet3', 0, -1, function(err, data) {
				callback(err, {'getSortedSetRange': data});
			});
		}

		function getSortedSetRevRange(callback) {
			db.getSortedSetRevRange('sortedSet3', 0, -1, function(err, data) {
				callback(err, {'getSortedSetRevRange': data});
			});
		}

		function getSortedSetRevRangeByScore(callback) {
			db.getSortedSetRevRangeByScore('sortedSet3', 0, 10, Infinity, 100, function(err, data) {
				callback(err, {'getSortedSetRevRangeByScore': data});
			});
		}

		function sortedSetCount(callback) {
			db.sortedSetCount('sortedSet3', -Infinity, Infinity, function(err, data) {
				callback(err, {'sortedSetCount': data});
			});
		}

		function sortedSetScore(callback) {
			db.sortedSetScore('users:joindate', 1, function(err, data) {
				callback(err, {'sortedSetScore': data});
			});
		}

		function sortedSetsScore(callback) {
			db.sortedSetsScore(['users:joindate', 'users:derp', 'users:postcount'], 1, function(err, data) {
				callback(err, {'sortedSetsScore': data});
			});
		}

		function isSortedSetMember(callback) {
			db.isSortedSetMember('sortedSet3', 5, function(err, data) {
				callback(err, {'sortedSetMember': data});
			});
		}

		function getSortedSetUnion(callback) {
			db.getSortedSetUnion(['users:joindate', 'users:derp', 'users:postcount'], 0, -1, function(err, data) {
				callback(err, {'sortedSetUnion': data});
			});
		}

		function getSortedSetRevUnion(callback) {
			db.getSortedSetRevUnion(['users:joindate', 'users:derp', 'users:postcount'], 0, -1, function(err, data) {
				callback(err, {'sortedSetUnion': data});
			});
		}

		var sortedSetTasks = [
			sortedSetAdd,
			sortedSetAdd,
			isSortedSetMember,
			getSortedSetRange,
			sortedSetAdd,
			getSortedSetRange,
			getSortedSetRevRange,
			sortedSetRemove,
			getSortedSetRange,
			sortedSetCount,
			sortedSetScore,
			sortedSetsScore,
			getSortedSetRevRangeByScore,
			getSortedSetUnion,
			getSortedSetRevUnion
		];

		async.series(sortedSetTasks, function(err, results) {
			assert.equal(err, null, 'error in sorted set methods');
			assert.ok(results);

			done();
		});

	});

	after(function() {
		db.flushdb();
	});
});
