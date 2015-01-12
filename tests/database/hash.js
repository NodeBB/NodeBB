'use strict';
/*global require, after*/

var	assert = require('assert'),
	db = require('../mocks/databasemock');

describe('Hash methods', function() {
	var testData = {
		name: 'baris',
		age: 99
	};

	before(function(done) {
		db.setObject('testObject1', testData, function(err) {
			assert.equal(err, null);
			assert.equal(arguments.length, 1);
			done();
		});
	})

	describe('setObject()', function() {
		it('should create a object', function(done) {
			db.setObject('testObject2', testData, function(err) {
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
			db.getObjects(['testObject1', 'testObject2', 'doesnotexist'], function(err, objects) {
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

	describe('getObjectField()', function() {
		it('should return falsy if object does not exist', function(done) {
			db.getObjectField('doesnotexist', 'fieldName', function(err, value) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.equal(!!value, false);
				done();
			});
		});

		it('should return falsy if field does not exist', function(done) {
			db.getObjectField('testObject1', 'fieldName', function(err, value) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.equal(!!value, false);
				done();
			});
		});

		it('should get an objects field', function(done) {
			db.getObjectField('testObject1', 'lastname', function(err, value) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.equal(value, 'usakli');
				done();
			});
		});
	});

	describe('getObjectFields()', function() {
		it('should return an object with falsy values', function(done) {
			db.getObjectFields('doesnotexist', ['field1', 'field2'], function(err, object) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.equal(typeof object, 'object');
				assert.equal(!!object.field1, false);
				assert.equal(!!object.field2, false);
				done();
			});
		});

		it('should return an object with correct fields', function(done) {
			db.getObjectFields('testObject1', ['lastname', 'age', 'field1'], function(err, object) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.equal(typeof object, 'object');
				assert.equal(object.lastname, 'usakli');
				assert.equal(object.age, 99);
				assert.equal(!!object.field1, false);
				done();
			});
		});
	});

	describe('getObjectsFields()', function() {
		it('should return an array of objects with correct values', function(done) {
			db.getObjectsFields(['testObject1', 'testObject2', 'doesnotexist'], ['name', 'age'], function(err, objects) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.equal(Array.isArray(objects), true);
				assert.equal(objects.length, 3);
				assert.equal(objects[0].name, 'baris');
				assert.equal(objects[0].age, 99);
				assert.equal(objects[1].name, 'ginger');
				assert.equal(!!objects[2].name, false);
				done();
			});
		});
	});

	describe('getObjectKeys()', function() {
		it('should return an empty array for a object that does not exist', function(done) {
			db.getObjectKeys('doesnotexist', function(err, keys) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.equal(Array.isArray(keys) && keys.length === 0, true);
				done();
			});
		});

		it('should return an array of keys for the object\'s fields', function(done) {
			db.getObjectKeys('testObject1', function(err, keys) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.equal(Array.isArray(keys) && keys.length === 3, true);
				keys.forEach(function(key) {
					assert.notEqual(['name', 'lastname', 'age'].indexOf(key), -1);
				});

				done();
			});
		});
	});

	describe('getObjectValues()', function() {
		it('should return an empty array for a object that does not exist', function(done) {
			db.getObjectValues('doesnotexist', function(err, values) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.equal(Array.isArray(values) && values.length === 0, true);
				done();
			});
		});

		it('should return an array of values for the object\'s fields', function(done) {
			db.getObjectValues('testObject1', function(err, values) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.equal(Array.isArray(values) && values.length === 3, true);
				values.forEach(function(value) {
					assert.notEqual(['baris', 'usakli', 99].indexOf(value), -1);
				});

				done();
			});
		});
	});

	describe('isObjectField()', function() {
		it('should return false if object does not exist', function(done) {
			db.isObjectField('doesnotexist', 'field1', function(err, value) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.equal(value, false);
				done();
			});
		});

		it('should return false if field does not exist', function(done) {
			db.isObjectField('testObject1', 'field1', function(err, value) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.equal(value, false);
				done();
			});
		});

		it('should return true if field exists', function(done) {
			db.isObjectField('testObject1', 'lastname', function(err, value) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.equal(value, true);
				done();
			});
		});
	});

	describe('deleteObjectField()', function() {
		it('should delete an objects field', function(done) {
			db.deleteObjectField('testObject1', 'lastname', function(err) {
				assert.equal(err, null);
				assert.equal(arguments.length, 1);
				db.isObjectField('testObject1', 'lastname', function(err, isField) {
					assert.equal(err, null);
					assert.equal(isField, false);
					done();
				});
			});
		});
	});

	describe('incrObjectField()', function() {
		it('should set an objects field to 1 if object does not exist', function(done) {
			db.incrObjectField('testObject3', 'field1', function(err, newValue) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.equal(newValue, 1);
				done();
			});
		});

		it('should increment an object fields by 1 and return it', function(done) {
			db.incrObjectField('testObject1', 'age', function(err, newValue) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.equal(newValue, 100);
				done();
			});
		});
	});

	describe('decrObjectField()', function() {
		it('should set an objects field to -1 if object does not exist', function(done) {
			db.decrObjectField('testObject4', 'field1', function(err, newValue) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.equal(newValue, -1);
				done();
			});
		});

		it('should decrement an object fields by 1 and return it', function(done) {
			db.decrObjectField('testObject1', 'age', function(err, newValue) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.equal(newValue, 99);
				done();
			});
		});
	});

	describe('incrObjectFieldBy()', function() {
		it('should set an objects field to 5 if object does not exist', function(done) {
			db.incrObjectFieldBy('testObject5', 'field1', 5, function(err, newValue) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.equal(newValue, 5);
				done();
			});
		});

		it('should increment an object fields by passed in value and return it', function(done) {
			db.incrObjectFieldBy('testObject1', 'age', 11, function(err, newValue) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.equal(newValue, 110);
				done();
			});
		});
	});



	after(function() {
		db.flushdb();
	});
});
