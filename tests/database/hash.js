'use strict';

var	async = require('async'),
	assert = require('assert'),
	db = require('../mocks/databasemock');

describe('Hash methods', function() {
	var testData = {
		name: 'baris',
		age: 99
	};

	describe('setObject()', function() {
		it('should create a object', function(done) {
			db.setObject('testObject1', testData, function(err) {
				assert.equal(err, null);
				assert.equal(arguments.length, 1);
				done();
			});
		});
	});

	describe('setObjectField()', function() {
		it('should add a new field to an object', function(done) {
			db.setObjectField('testObject1', 'lastname', 'usakli', function(err) {
				assert.equal(err, null);
				assert.equal(arguments.length, 1);
				done();
			});
		});

		it('should create a new object with field', function(done) {
			db.setObjectField('testObject2', 'name', 'ginger', function(err) {
				assert.equal(err, null);
				assert.equal(arguments.length, 1);
				done();
			});
		});
	});

	describe('getObject()', function() {
		it('should return falsy if object does not exist', function(done) {
			db.getObject('doesnotexist', function(err, data) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.equal(!!data, false);
				done();
			});
		});

		it('should retrieve an object', function(done) {
			db.getObject('testObject1', function(err, data) {
				assert.equal(err, null);
				assert.equal(data.name, testData.name);
				assert.equal(data.age, testData.age);
				assert.equal(data.lastname, 'usakli');
				done();
			});
		});
	});

	describe('getObjects()', function() {
		it('should return 3 objects with correct data', function(done) {
			db.getObjects(['testObject1' 'testObject2', 'doesnotexist'], function(err, objects) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.equal(Array.isArray(objects) && objects.length === 3, true);
				assert.equal(objects[0].name, 'baris');
				assert.equal(objects[1].name, 'ginger');
				assert.equal(!!objects[2], false);
				done();
			});
		});
	});



	after(function() {
		db.flushdb();
	});
});
