'use strict';


var	async = require('async');
var assert = require('assert');
var db = require('../mocks/databasemock');

describe('Hash methods', function () {
	var testData = {
		name: 'baris',
		lastname: 'usakli',
		age: 99,
	};

	beforeEach(function (done) {
		db.setObject('hashTestObject', testData, done);
	});

	describe('setObject()', function () {
		it('should create a object', function (done) {
			db.setObject('testObject1', { foo: 'baris', bar: 99 }, function (err) {
				assert.ifError(err);
				assert(arguments.length < 2);
				done();
			});
		});

		it('should do nothing if key is falsy', function (done) {
			db.setObject('', { foo: 1, derp: 2 }, function (err) {
				assert.ifError(err);
				done();
			});
		});

		it('should do nothing if data is falsy', function (done) {
			db.setObject('falsy', null, function (err) {
				assert.ifError(err);
				db.exists('falsy', function (err, exists) {
					assert.ifError(err);
					assert.equal(exists, false);
					done();
				});
			});
		});

		it('should not error if a key is empty string', function (done) {
			db.setObject('emptyField', { '': '', b: 1 }, function (err) {
				assert.ifError(err);
				db.getObject('emptyField', function (err, data) {
					assert.ifError(err);
					done();
				});
			});
		});
	});

	describe('setObjectField()', function () {
		it('should create a new object with field', function (done) {
			db.setObjectField('testObject2', 'name', 'ginger', function (err) {
				assert.ifError(err);
				assert(arguments.length < 2);
				done();
			});
		});

		it('should add a new field to an object', function (done) {
			db.setObjectField('testObject2', 'type', 'cat', function (err) {
				assert.ifError(err, null);
				assert(arguments.length < 2);
				done();
			});
		});
	});

	describe('getObject()', function () {
		it('should return falsy if object does not exist', function (done) {
			db.getObject('doesnotexist', function (err, data) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.equal(!!data, false);
				done();
			});
		});

		it('should retrieve an object', function (done) {
			db.getObject('hashTestObject', function (err, data) {
				assert.equal(err, null);
				assert.equal(data.name, testData.name);
				assert.equal(data.age, testData.age);
				assert.equal(data.lastname, 'usakli');
				done();
			});
		});
	});

	describe('getObjects()', function () {
		before(function (done) {
			async.parallel([
				async.apply(db.setObject, 'testObject4', { name: 'baris' }),
				async.apply(db.setObjectField, 'testObject5', 'name', 'ginger'),
			], done);
		});

		it('should return 3 objects with correct data', function (done) {
			db.getObjects(['testObject4', 'testObject5', 'doesnotexist'], function (err, objects) {
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

	describe('getObjectField()', function () {
		it('should return falsy if object does not exist', function (done) {
			db.getObjectField('doesnotexist', 'fieldName', function (err, value) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.equal(!!value, false);
				done();
			});
		});

		it('should return falsy if field does not exist', function (done) {
			db.getObjectField('hashTestObject', 'fieldName', function (err, value) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.equal(!!value, false);
				done();
			});
		});

		it('should get an objects field', function (done) {
			db.getObjectField('hashTestObject', 'lastname', function (err, value) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.equal(value, 'usakli');
				done();
			});
		});
	});

	describe('getObjectFields()', function () {
		it('should return an object with falsy values', function (done) {
			db.getObjectFields('doesnotexist', ['field1', 'field2'], function (err, object) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.equal(typeof object, 'object');
				assert.equal(!!object.field1, false);
				assert.equal(!!object.field2, false);
				done();
			});
		});

		it('should return an object with correct fields', function (done) {
			db.getObjectFields('hashTestObject', ['lastname', 'age', 'field1'], function (err, object) {
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

	describe('getObjectsFields()', function () {
		before(function (done) {
			async.parallel([
				async.apply(db.setObject, 'testObject8', { name: 'baris', age: 99 }),
				async.apply(db.setObject, 'testObject9', { name: 'ginger', age: 3 }),
			], done);
		});

		it('should return an array of objects with correct values', function (done) {
			db.getObjectsFields(['testObject8', 'testObject9', 'doesnotexist'], ['name', 'age'], function (err, objects) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.equal(Array.isArray(objects), true);
				assert.equal(objects.length, 3);
				assert.equal(objects[0].name, 'baris');
				assert.equal(objects[0].age, 99);
				assert.equal(objects[1].name, 'ginger');
				assert.equal(objects[1].age, 3);
				assert.equal(!!objects[2].name, false);
				done();
			});
		});

		it('should return undefined for all fields if object does not exist', function (done) {
			db.getObjectsFields(['doesnotexist1', 'doesnotexist2'], ['name', 'age'], function (err, data) {
				assert.ifError(err);
				assert(Array.isArray(data));
				assert.equal(data[0].name, null);
				assert.equal(data[0].age, null);
				assert.equal(data[1].name, null);
				assert.equal(data[1].age, null);
				done();
			});
		});
	});

	describe('getObjectKeys()', function () {
		it('should return an empty array for a object that does not exist', function (done) {
			db.getObjectKeys('doesnotexist', function (err, keys) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.equal(Array.isArray(keys) && keys.length === 0, true);
				done();
			});
		});

		it('should return an array of keys for the object\'s fields', function (done) {
			db.getObjectKeys('hashTestObject', function (err, keys) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.equal(Array.isArray(keys) && keys.length === 3, true);
				keys.forEach(function (key) {
					assert.notEqual(['name', 'lastname', 'age'].indexOf(key), -1);
				});
				done();
			});
		});
	});

	describe('getObjectValues()', function () {
		it('should return an empty array for a object that does not exist', function (done) {
			db.getObjectValues('doesnotexist', function (err, values) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.equal(Array.isArray(values) && values.length === 0, true);
				done();
			});
		});

		it('should return an array of values for the object\'s fields', function (done) {
			db.getObjectValues('hashTestObject', function (err, values) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.equal(Array.isArray(values) && values.length === 3, true);
				assert.deepEqual(['baris', 'usakli', 99].sort(), values.sort());
				done();
			});
		});
	});

	describe('isObjectField()', function () {
		it('should return false if object does not exist', function (done) {
			db.isObjectField('doesnotexist', 'field1', function (err, value) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.equal(value, false);
				done();
			});
		});

		it('should return false if field does not exist', function (done) {
			db.isObjectField('hashTestObject', 'field1', function (err, value) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.equal(value, false);
				done();
			});
		});

		it('should return true if field exists', function (done) {
			db.isObjectField('hashTestObject', 'name', function (err, value) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.equal(value, true);
				done();
			});
		});
	});


	describe('isObjectFields()', function () {
		it('should return an array of false if object does not exist', function (done) {
			db.isObjectFields('doesnotexist', ['field1', 'field2'], function (err, values) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.deepEqual(values, [false, false]);
				done();
			});
		});

		it('should return false if field does not exist', function (done) {
			db.isObjectFields('hashTestObject', ['name', 'age', 'field1'], function (err, values) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.deepEqual(values, [true, true, false]);
				done();
			});
		});
	});

	describe('deleteObjectField()', function () {
		before(function (done) {
			db.setObject('testObject10', { foo: 'bar', delete: 'this', delete1: 'this', delete2: 'this' }, done);
		});

		it('should delete an objects field', function (done) {
			db.deleteObjectField('testObject10', 'delete', function (err) {
				assert.ifError(err);
				assert(arguments.length < 2);
				db.isObjectField('testObject10', 'delete', function (err, isField) {
					assert.ifError(err);
					assert.equal(isField, false);
					done();
				});
			});
		});

		it('should delete multiple fields of the object', function (done) {
			db.deleteObjectFields('testObject10', ['delete1', 'delete2'], function (err) {
				assert.ifError(err);
				assert(arguments.length < 2);
				async.parallel({
					delete1: async.apply(db.isObjectField, 'testObject10', 'delete1'),
					delete2: async.apply(db.isObjectField, 'testObject10', 'delete2'),
				}, function (err, results) {
					assert.ifError(err);
					assert.equal(results.delete1, false);
					assert.equal(results.delete2, false);
					done();
				});
			});
		});

		it('should not error if key is undefined', function (done) {
			db.deleteObjectField(undefined, 'someField', function (err) {
				assert.ifError(err);
				done();
			});
		});

		it('should not error if key is null', function (done) {
			db.deleteObjectField(null, 'someField', function (err) {
				assert.ifError(err);
				done();
			});
		});

		it('should not error if field is undefined', function (done) {
			db.deleteObjectField('someKey', undefined, function (err) {
				assert.ifError(err);
				done();
			});
		});

		it('should not error if field is null', function (done) {
			db.deleteObjectField('someKey', null, function (err) {
				assert.ifError(err);
				done();
			});
		});
	});

	describe('incrObjectField()', function () {
		before(function (done) {
			db.setObject('testObject11', { age: 99 }, done);
		});

		it('should set an objects field to 1 if object does not exist', function (done) {
			db.incrObjectField('testObject12', 'field1', function (err, newValue) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.equal(newValue, 1);
				done();
			});
		});

		it('should increment an object fields by 1 and return it', function (done) {
			db.incrObjectField('testObject11', 'age', function (err, newValue) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.equal(newValue, 100);
				done();
			});
		});
	});

	describe('decrObjectField()', function () {
		before(function (done) {
			db.setObject('testObject13', { age: 99 }, done);
		});

		it('should set an objects field to -1 if object does not exist', function (done) {
			db.decrObjectField('testObject14', 'field1', function (err, newValue) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.equal(newValue, -1);
				done();
			});
		});

		it('should decrement an object fields by 1 and return it', function (done) {
			db.decrObjectField('testObject13', 'age', function (err, newValue) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.equal(newValue, 98);
				done();
			});
		});

		it('should decrement multiple objects field by 1 and return an array of new values', function (done) {
			db.decrObjectField(['testObject13', 'testObject14', 'decrTestObject'], 'age', function (err, data) {
				assert.ifError(err);
				assert.equal(data[0], 97);
				assert.equal(data[1], -1);
				assert.equal(data[2], -1);
				done();
			});
		});
	});

	describe('incrObjectFieldBy()', function () {
		before(function (done) {
			db.setObject('testObject15', { age: 100 }, done);
		});

		it('should set an objects field to 5 if object does not exist', function (done) {
			db.incrObjectFieldBy('testObject16', 'field1', 5, function (err, newValue) {
				assert.ifError(err);
				assert.equal(arguments.length, 2);
				assert.equal(newValue, 5);
				done();
			});
		});

		it('should increment an object fields by passed in value and return it', function (done) {
			db.incrObjectFieldBy('testObject15', 'age', 11, function (err, newValue) {
				assert.ifError(err);
				assert.equal(arguments.length, 2);
				assert.equal(newValue, 111);
				done();
			});
		});

		it('should increment an object fields by passed in value and return it', function (done) {
			db.incrObjectFieldBy('testObject15', 'age', '11', function (err, newValue) {
				assert.ifError(err);
				assert.equal(newValue, 122);
				done();
			});
		});

		it('should return null if value is NaN', function (done) {
			db.incrObjectFieldBy('testObject15', 'lastonline', 'notanumber', function (err, newValue) {
				assert.ifError(err);
				assert.strictEqual(newValue, null);
				db.isObjectField('testObject15', 'lastonline', function (err, isField) {
					assert.ifError(err);
					assert(!isField);
					done();
				});
			});
		});
	});
});
