'use strict';


const async = require('async');
const assert = require('assert');
const db = require('../mocks/databasemock');

describe('Hash methods', () => {
	const testData = {
		name: 'baris',
		lastname: 'usakli',
		age: 99,
	};

	beforeEach((done) => {
		db.setObject('hashTestObject', testData, done);
	});

	describe('setObject()', () => {
		it('should create a object', (done) => {
			db.setObject('testObject1', { foo: 'baris', bar: 99 }, function (err) {
				assert.ifError(err);
				assert(arguments.length < 2);
				done();
			});
		});

		it('should set two objects to same data', async () => {
			const data = { foo: 'baz', test: '1' };
			await db.setObject(['multiObject1', 'multiObject2'], data);
			const result = await db.getObjects(['multiObject1', 'multiObject2']);
			assert.deepStrictEqual(result[0], data);
			assert.deepStrictEqual(result[1], data);
		});

		it('should do nothing if key is falsy', (done) => {
			db.setObject('', { foo: 1, derp: 2 }, (err) => {
				assert.ifError(err);
				done();
			});
		});

		it('should do nothing if data is falsy', (done) => {
			db.setObject('falsy', null, (err) => {
				assert.ifError(err);
				db.exists('falsy', (err, exists) => {
					assert.ifError(err);
					assert.equal(exists, false);
					done();
				});
			});
		});

		it('should not error if a key is empty string', (done) => {
			db.setObject('emptyField', { '': '', b: 1 }, (err) => {
				assert.ifError(err);
				db.getObject('emptyField', (err, data) => {
					assert.ifError(err);
					done();
				});
			});
		});

		it('should work for field names with "." in them', (done) => {
			db.setObject('dotObject', { 'my.dot.field': 'foo' }, (err) => {
				assert.ifError(err);
				db.getObject('dotObject', (err, data) => {
					assert.ifError(err);
					assert.equal(data['my.dot.field'], 'foo');
					done();
				});
			});
		});

		it('should set multiple keys to different okjects', async () => {
			const keys = ['bulkKey1', 'bulkKey2'];
			const data = [{ foo: '1' }, { baz: 'baz' }];

			await db.setObjectBulk(keys, data);
			const result = await db.getObjects(keys);
			assert.deepStrictEqual(result, data);
		});
	});

	describe('setObjectField()', () => {
		it('should create a new object with field', (done) => {
			db.setObjectField('testObject2', 'name', 'ginger', function (err) {
				assert.ifError(err);
				assert(arguments.length < 2);
				done();
			});
		});

		it('should add a new field to an object', (done) => {
			db.setObjectField('testObject2', 'type', 'cat', function (err) {
				assert.ifError(err, null);
				assert(arguments.length < 2);
				done();
			});
		});

		it('should set two objects fields to same data', async () => {
			const data = { foo: 'baz', test: '1' };
			await db.setObjectField(['multiObject1', 'multiObject2'], 'myField', '2');
			const result = await db.getObjects(['multiObject1', 'multiObject2']);
			assert.deepStrictEqual(result[0].myField, '2');
			assert.deepStrictEqual(result[1].myField, '2');
		});

		it('should work for field names with "." in them', (done) => {
			db.setObjectField('dotObject2', 'my.dot.field', 'foo2', (err) => {
				assert.ifError(err);
				db.getObjectField('dotObject2', 'my.dot.field', (err, value) => {
					assert.ifError(err);
					assert.equal(value, 'foo2');
					done();
				});
			});
		});

		it('should work for field names with "." in them when they are cached', (done) => {
			db.setObjectField('dotObject3', 'my.dot.field', 'foo2', (err) => {
				assert.ifError(err);
				db.getObject('dotObject3', (err, data) => {
					assert.ifError(err);
					db.getObjectField('dotObject3', 'my.dot.field', (err, value) => {
						assert.ifError(err);
						assert.equal(value, 'foo2');
						done();
					});
				});
			});
		});
	});

	describe('getObject()', () => {
		it('should return falsy if object does not exist', (done) => {
			db.getObject('doesnotexist', function (err, data) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.equal(!!data, false);
				done();
			});
		});

		it('should retrieve an object', (done) => {
			db.getObject('hashTestObject', (err, data) => {
				assert.equal(err, null);
				assert.equal(data.name, testData.name);
				assert.equal(data.age, testData.age);
				assert.equal(data.lastname, 'usakli');
				done();
			});
		});

		it('should return null if key is falsy', (done) => {
			db.getObject(null, function (err, data) {
				assert.ifError(err);
				assert.equal(arguments.length, 2);
				assert.equal(data, null);
				done();
			});
		});

		it('should return fields if given', async () => {
			const data = await db.getObject('hashTestObject', ['name', 'age']);
			assert.strictEqual(data.name, 'baris');
			assert.strictEqual(parseInt(data.age, 10), 99);
		});
	});

	describe('getObjects()', () => {
		before((done) => {
			async.parallel([
				async.apply(db.setObject, 'testObject4', { name: 'baris' }),
				async.apply(db.setObjectField, 'testObject5', 'name', 'ginger'),
			], done);
		});

		it('should return 3 objects with correct data', (done) => {
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

		it('should return fields if given', async () => {
			await db.setObject('fieldsObj1', { foo: 'foo', baz: 'baz', herp: 'herp' });
			await db.setObject('fieldsObj2', { foo: 'foo2', baz: 'baz2', herp: 'herp2', onlyin2: 'onlyin2' });
			const data = await db.getObjects(['fieldsObj1', 'fieldsObj2'], ['baz', 'doesnotexist', 'onlyin2']);
			assert.strictEqual(data[0].baz, 'baz');
			assert.strictEqual(data[0].doesnotexist, null);
			assert.strictEqual(data[0].onlyin2, null);
			assert.strictEqual(data[1].baz, 'baz2');
			assert.strictEqual(data[1].doesnotexist, null);
			assert.strictEqual(data[1].onlyin2, 'onlyin2');
		});
	});

	describe('getObjectField()', () => {
		it('should return falsy if object does not exist', (done) => {
			db.getObjectField('doesnotexist', 'fieldName', function (err, value) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.equal(!!value, false);
				done();
			});
		});

		it('should return falsy if field does not exist', (done) => {
			db.getObjectField('hashTestObject', 'fieldName', function (err, value) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.equal(!!value, false);
				done();
			});
		});

		it('should get an objects field', (done) => {
			db.getObjectField('hashTestObject', 'lastname', function (err, value) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.equal(value, 'usakli');
				done();
			});
		});

		it('should return null if key is falsy', (done) => {
			db.getObjectField(null, 'test', function (err, data) {
				assert.ifError(err);
				assert.equal(arguments.length, 2);
				assert.equal(data, null);
				done();
			});
		});

		it('should return null and not error', async () => {
			const data = await db.getObjectField('hashTestObject', ['field1', 'field2']);
			assert.strictEqual(data, null);
		});
	});

	describe('getObjectFields()', () => {
		it('should return an object with falsy values', (done) => {
			db.getObjectFields('doesnotexist', ['field1', 'field2'], function (err, object) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.equal(typeof object, 'object');
				assert.equal(!!object.field1, false);
				assert.equal(!!object.field2, false);
				done();
			});
		});

		it('should return an object with correct fields', (done) => {
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

		it('should return null if key is falsy', (done) => {
			db.getObjectFields(null, ['test', 'foo'], function (err, data) {
				assert.ifError(err);
				assert.equal(arguments.length, 2);
				assert.equal(data, null);
				done();
			});
		});
	});

	describe('getObjectsFields()', () => {
		before((done) => {
			async.parallel([
				async.apply(db.setObject, 'testObject8', { name: 'baris', age: 99 }),
				async.apply(db.setObject, 'testObject9', { name: 'ginger', age: 3 }),
			], done);
		});

		it('should return an array of objects with correct values', (done) => {
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

		it('should return undefined for all fields if object does not exist', (done) => {
			db.getObjectsFields(['doesnotexist1', 'doesnotexist2'], ['name', 'age'], (err, data) => {
				assert.ifError(err);
				assert(Array.isArray(data));
				assert.equal(data[0].name, null);
				assert.equal(data[0].age, null);
				assert.equal(data[1].name, null);
				assert.equal(data[1].age, null);
				done();
			});
		});

		it('should return all fields if fields is empty array', async () => {
			const objects = await db.getObjectsFields(['testObject8', 'testObject9', 'doesnotexist'], []);
			assert(Array.isArray(objects));
			assert.strict(objects.length, 3);
			assert.strictEqual(objects[0].name, 'baris');
			assert.strictEqual(Number(objects[0].age), 99);
			assert.strictEqual(objects[1].name, 'ginger');
			assert.strictEqual(Number(objects[1].age), 3);
			assert.strictEqual(!!objects[2], false);
		});
	});

	describe('getObjectKeys()', () => {
		it('should return an empty array for a object that does not exist', (done) => {
			db.getObjectKeys('doesnotexist', function (err, keys) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.equal(Array.isArray(keys) && keys.length === 0, true);
				done();
			});
		});

		it('should return an array of keys for the object\'s fields', (done) => {
			db.getObjectKeys('hashTestObject', function (err, keys) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.equal(Array.isArray(keys) && keys.length === 3, true);
				keys.forEach((key) => {
					assert.notEqual(['name', 'lastname', 'age'].indexOf(key), -1);
				});
				done();
			});
		});
	});

	describe('getObjectValues()', () => {
		it('should return an empty array for a object that does not exist', (done) => {
			db.getObjectValues('doesnotexist', function (err, values) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.equal(Array.isArray(values) && values.length === 0, true);
				done();
			});
		});

		it('should return an array of values for the object\'s fields', (done) => {
			db.getObjectValues('hashTestObject', function (err, values) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.equal(Array.isArray(values) && values.length === 3, true);
				assert.deepEqual(['baris', 'usakli', 99].sort(), values.sort());
				done();
			});
		});
	});

	describe('isObjectField()', () => {
		it('should return false if object does not exist', (done) => {
			db.isObjectField('doesnotexist', 'field1', function (err, value) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.equal(value, false);
				done();
			});
		});

		it('should return false if field does not exist', (done) => {
			db.isObjectField('hashTestObject', 'field1', function (err, value) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.equal(value, false);
				done();
			});
		});

		it('should return true if field exists', (done) => {
			db.isObjectField('hashTestObject', 'name', function (err, value) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.equal(value, true);
				done();
			});
		});
	});


	describe('isObjectFields()', () => {
		it('should return an array of false if object does not exist', (done) => {
			db.isObjectFields('doesnotexist', ['field1', 'field2'], function (err, values) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.deepEqual(values, [false, false]);
				done();
			});
		});

		it('should return false if field does not exist', (done) => {
			db.isObjectFields('hashTestObject', ['name', 'age', 'field1'], function (err, values) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.deepEqual(values, [true, true, false]);
				done();
			});
		});
	});

	describe('deleteObjectField()', () => {
		before((done) => {
			db.setObject('testObject10', { foo: 'bar', delete: 'this', delete1: 'this', delete2: 'this' }, done);
		});

		it('should delete an objects field', (done) => {
			db.deleteObjectField('testObject10', 'delete', function (err) {
				assert.ifError(err);
				assert(arguments.length < 2);
				db.isObjectField('testObject10', 'delete', (err, isField) => {
					assert.ifError(err);
					assert.equal(isField, false);
					done();
				});
			});
		});

		it('should delete multiple fields of the object', (done) => {
			db.deleteObjectFields('testObject10', ['delete1', 'delete2'], function (err) {
				assert.ifError(err);
				assert(arguments.length < 2);
				async.parallel({
					delete1: async.apply(db.isObjectField, 'testObject10', 'delete1'),
					delete2: async.apply(db.isObjectField, 'testObject10', 'delete2'),
				}, (err, results) => {
					assert.ifError(err);
					assert.equal(results.delete1, false);
					assert.equal(results.delete2, false);
					done();
				});
			});
		});

		it('should delete multiple fields of multiple objects', async () => {
			await db.setObject('deleteFields1', { foo: 'foo1', baz: '2' });
			await db.setObject('deleteFields2', { foo: 'foo2', baz: '3' });
			await db.deleteObjectFields(['deleteFields1', 'deleteFields2'], ['baz']);
			const obj1 = await db.getObject('deleteFields1');
			const obj2 = await db.getObject('deleteFields2');
			assert.deepStrictEqual(obj1, { foo: 'foo1' });
			assert.deepStrictEqual(obj2, { foo: 'foo2' });
		});

		it('should not error if fields is empty array', async () => {
			await db.deleteObjectFields('someKey', []);
		});

		it('should not error if key is undefined', (done) => {
			db.deleteObjectField(undefined, 'someField', (err) => {
				assert.ifError(err);
				done();
			});
		});

		it('should not error if key is null', (done) => {
			db.deleteObjectField(null, 'someField', (err) => {
				assert.ifError(err);
				done();
			});
		});

		it('should not error if field is undefined', (done) => {
			db.deleteObjectField('someKey', undefined, (err) => {
				assert.ifError(err);
				done();
			});
		});

		it('should not error if one of the fields is undefined', async () => {
			await db.deleteObjectFields('someKey', ['best', undefined]);
		});

		it('should not error if field is null', (done) => {
			db.deleteObjectField('someKey', null, (err) => {
				assert.ifError(err);
				done();
			});
		});
	});

	describe('incrObjectField()', () => {
		before((done) => {
			db.setObject('testObject11', { age: 99 }, done);
		});

		it('should set an objects field to 1 if object does not exist', (done) => {
			db.incrObjectField('testObject12', 'field1', function (err, newValue) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.strictEqual(newValue, 1);
				done();
			});
		});

		it('should increment an object fields by 1 and return it', (done) => {
			db.incrObjectField('testObject11', 'age', function (err, newValue) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.strictEqual(newValue, 100);
				done();
			});
		});
	});

	describe('decrObjectField()', () => {
		before((done) => {
			db.setObject('testObject13', { age: 99 }, done);
		});

		it('should set an objects field to -1 if object does not exist', (done) => {
			db.decrObjectField('testObject14', 'field1', function (err, newValue) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.equal(newValue, -1);
				done();
			});
		});

		it('should decrement an object fields by 1 and return it', (done) => {
			db.decrObjectField('testObject13', 'age', function (err, newValue) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.equal(newValue, 98);
				done();
			});
		});

		it('should decrement multiple objects field by 1 and return an array of new values', (done) => {
			db.decrObjectField(['testObject13', 'testObject14', 'decrTestObject'], 'age', (err, data) => {
				assert.ifError(err);
				assert.equal(data[0], 97);
				assert.equal(data[1], -1);
				assert.equal(data[2], -1);
				done();
			});
		});
	});

	describe('incrObjectFieldBy()', () => {
		before((done) => {
			db.setObject('testObject15', { age: 100 }, done);
		});

		it('should set an objects field to 5 if object does not exist', (done) => {
			db.incrObjectFieldBy('testObject16', 'field1', 5, function (err, newValue) {
				assert.ifError(err);
				assert.equal(arguments.length, 2);
				assert.equal(newValue, 5);
				done();
			});
		});

		it('should increment an object fields by passed in value and return it', (done) => {
			db.incrObjectFieldBy('testObject15', 'age', 11, function (err, newValue) {
				assert.ifError(err);
				assert.equal(arguments.length, 2);
				assert.equal(newValue, 111);
				done();
			});
		});

		it('should increment an object fields by passed in value and return it', (done) => {
			db.incrObjectFieldBy('testObject15', 'age', '11', (err, newValue) => {
				assert.ifError(err);
				assert.equal(newValue, 122);
				done();
			});
		});

		it('should return null if value is NaN', (done) => {
			db.incrObjectFieldBy('testObject15', 'lastonline', 'notanumber', (err, newValue) => {
				assert.ifError(err);
				assert.strictEqual(newValue, null);
				db.isObjectField('testObject15', 'lastonline', (err, isField) => {
					assert.ifError(err);
					assert(!isField);
					done();
				});
			});
		});
	});
});
