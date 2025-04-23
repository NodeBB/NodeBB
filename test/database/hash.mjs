import assert from 'assert';
import db from '../mocks/databasemock.mjs';

describe('Hash methods', () => {
	const testData = {
		name: 'baris',
		lastname: 'usakli',
		age: 99,
	};

	beforeEach(async function () {
		await db.setObject('hashTestObject', testData);
	});

	describe('setObject()', () => {
		it('should create a object', async function () {
			await db.setObject('testObject1', { foo: 'baris', bar: 99 });
			const testObject1 = await db.getObject('testObject1');
			assert.deepStrictEqual(testObject1, { foo: 'baris', bar: 99 });
		});

		it('should overwrite a value', async function () {
			await db.delete('testObject1');
			await db.setObject('testObject1', { foo: 'baris', bar: 99 });
			await db.setObject('testObject1', { foo: 'baris', bar: 100 });
			const testObject1 = await db.getObject('testObject1');
			assert.deepStrictEqual(testObject1, { foo: 'baris', bar: 100 });
		});

		it('should set two objects to same data', async function () {
			const data = { foo: 'baz', test: '1' };
			await db.setObject(['multiObject1', 'multiObject2'], data);
			const result = await db.getObjects(['multiObject1', 'multiObject2']);
			assert.deepStrictEqual(result[0], data);
			assert.deepStrictEqual(result[1], data);
		});

		it('should do nothing if key is falsy', async function () {
			await db.setObject('', { foo: 1, derp: 2 });
		});

		it('should do nothing if data is falsy', async function () {
			await db.setObject('falsy', null);
			const exists = await db.exists('falsy');
			assert.strictEqual(exists, false);
		});

		it('should not error if a key is empty string', async function () {
			await db.setObject('emptyField', { '': '', b: 1 });
			const data = await db.getObject('emptyField');
			assert.deepStrictEqual(data, { b: 1 });
		});

		it('should work for field names with "." in them', async function () {
			await db.setObject('dotObject', { 'my.dot.field': 'foo' });
			const dotObject = await db.getObject('dotObject');
			assert.deepStrictEqual(dotObject, { 'my.dot.field': 'foo' });
		});

		it('should set multiple keys to different objects', async function () {
			await db.setObjectBulk([
				['bulkKey1', { foo: '1' }],
				['bulkKey2', { baz: 'baz' }],
			]);
			const result = await db.getObjects(['bulkKey1', 'bulkKey2']);
			assert.deepStrictEqual(result, [{ foo: '1' }, { baz: 'baz' }]);
		});

		it('should not error if object is empty (setObjectBulk, two keys)', async function () {
			await db.setObjectBulk([
				['bulkKey3', { foo: '1' }],
				['bulkKey4', {}],
			]);
			const result = await db.getObjects(['bulkKey3', 'bulkKey4']);
			assert.deepStrictEqual(result, [{ foo: '1' }, null]);
		});

		it('should not error if object is empty (setObjectBulk, one key)', async function () {
			await db.setObjectBulk([
				['bulkKey5', {}]
			]);
			const result = await db.getObjects(['bulkKey5']);
			assert.deepStrictEqual(result, [null]);
		});

		it('should not error if object is empty (setObject, two keys)', async function () {
			const keys = ['bulkKey6', 'bulkKey7'];
			const data = {};
			await db.setObject(keys, data);
			const result = await db.getObjects(keys);
			assert.deepStrictEqual(result, [null, null]);
		});

		it('should not error if object is empty, (setObject, one key)', async function () {
			await db.setObject('emptykey', {});
			const result = await db.getObject('emptykey');
			assert.deepStrictEqual(result, null);
		});

		it('should update existing object on second call', async function () {
			await db.setObjectBulk([['bulkKey3.5', { foo: '1' }]]);
			await db.setObjectBulk([['bulkKey3.5', { baz: '2' }]]);
			const result = await db.getObject('bulkKey3.5');
			assert.deepStrictEqual(result, { foo: '1', baz: '2' });
		});
	});

	describe('setObjectField()', () => {
		it('should create a new object with field', async function () {
			await db.delete('testObject2');
			assert.deepStrictEqual(await db.getObject('testObject2'), null);
			await db.setObjectField('testObject2', 'name', 'ginger');
			const testObject2 = await db.getObject('testObject2');
			assert.deepStrictEqual(testObject2, { name: 'ginger' });
		});

		it('should add a new field to an object', async function () {
			await db.delete('testObject2');
			assert.deepStrictEqual(await db.getObject('testObject2'), null);
			await db.setObject('testObject2', { name: 'ginger' });
			await db.setObjectField('testObject2', 'type', 'cat');
			const actual = await db.getObject('testObject2');
			const expected = { name: 'ginger', type: 'cat' };
			assert.deepStrictEqual(actual, expected);
		});

		it('should overwrite an existing field with new value', async function () {
			await db.delete('testObject2');
			assert.deepStrictEqual(await db.getObject('testObject2'), null);
			await db.setObject('testObject2', { name: 'ginger' });
			assert.deepStrictEqual(
				await db.getObject('testObject2'),
				{ name: 'ginger' }
			);
			await db.setObjectField('testObject2', 'name', 'new_ginger');
			assert.deepStrictEqual(
				await db.getObject('testObject2'),
				{ name: 'new_ginger' }
			);
		});

		it('should set two objects fields to same data (create new)', async function () {
			await db.deleteAll(['multiObject1', 'multiObject2']);
			assert.deepStrictEqual(await db.getObjects(['multiObject1', 'multiObject2']), [null, null]);

			const data = { foo: 'baz', test: '1' };
			await db.setObjectField(['multiObject1', 'multiObject2'], 'myField', '2');
			const result = await db.getObjects(['multiObject1', 'multiObject2']);
			assert.strictEqual(result[0].myField, '2');
			assert.strictEqual(result[1].myField, '2');
		});

		it('should set two objects fields to same data (add fields)', async function () {
			await db.deleteAll(['multiObject1', 'multiObject2']);
			assert.deepStrictEqual(await db.getObjects(['multiObject1', 'multiObject2']), [null, null]);

			const data = { foo: 'baz', test: '1' };
			await db.setObject(['multiObject1', 'multiObject2'], data);
			assert.deepStrictEqual(await db.getObjects(['multiObject1', 'multiObject2']), [data, data]);

			await db.setObjectField(['multiObject1', 'multiObject2'], 'myField', '2');
			const result = await db.getObjects(['multiObject1', 'multiObject2']);
			assert.deepStrictEqual(result, [{ ...data, myField: '2' }, { ...data, myField: '2' }]);
		});

		it('should work for field names with "." in them', async function () {
			await db.setObjectField('dotObject2', 'my.dot.field', 'foo2');
			const value = await db.getObjectField('dotObject2', 'my.dot.field');
			assert.strictEqual(value, 'foo2');
		});

		it('should work for field names with "." in them when they are cached', async function () {
			await db.setObjectField('dotObject3', 'my.dot.field', 'foo2');
			const data = await db.getObject('dotObject3');
			assert.strictEqual(data['my.dot.field'], 'foo2');
			const value = await db.getObjectField('dotObject3', 'my.dot.field');
			assert.strictEqual(value, 'foo2');
		});

		it('should work for fields that start with $', async function () {
			await db.setObjectField('dollarsign', '$someField', 'foo');
			assert.strictEqual(await db.getObjectField('dollarsign', '$someField'), 'foo');
			assert.strictEqual(await db.isObjectField('dollarsign', '$someField'), true);
			assert.strictEqual(await db.isObjectField('dollarsign', '$doesntexist'), false);
			await db.deleteObjectField('dollarsign', '$someField');
			assert.strictEqual(await db.isObjectField('dollarsign', '$someField'), false);
		});
	});

	describe('getObject()', () => {
		it('should return falsy if object does not exist', async function () {
			const data = await db.getObject('doesnotexist');
			assert.strictEqual(!!data, false);
		});

		it('should retrieve an object', async function () {
			const data = await db.getObject('hashTestObject');
			assert.deepStrictEqual(data, testData);
		});

		it('should return null if key is falsy', async function () {
			const data = await db.getObject(null);
			assert.strictEqual(data, null);
		});

		it('should return fields if given', async function () {
			const data = await db.getObject('hashTestObject', ['name', 'age']);
			assert.deepStrictEqual(data, { name: 'baris', age: 99 });
		});
	});

	describe('getObjects()', () => {
		before(async function () {
			await Promise.all([
				db.setObject('testObject4', { name: 'baris' }),
				db.setObjectField('testObject5', 'name', 'ginger'),
			]);
		});

		it('should return 3 objects with correct data', async function () {
			const objects = await db.getObjects(['testObject4', 'testObject5', 'doesnotexist']);
			assert(Array.isArray(objects) && objects.length === 3);
			assert.strictEqual(objects[0].name, 'baris');
			assert.strictEqual(objects[1].name, 'ginger');
			assert.strictEqual(!!objects[2], false);
		});

		it('should return fields if given', async function () {
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
		it('should return falsy if object does not exist', async function () {
			const value = await db.getObjectField('doesnotexist', 'fieldName');
			assert.strictEqual(!!value, false);
		});

		it('should return falsy if field does not exist', async function () {
			const value = await db.getObjectField('hashTestObject', 'fieldName');
			assert.strictEqual(!!value, false);
		});

		it('should get an objects field', async function () {
			const value = await db.getObjectField('hashTestObject', 'lastname');
			assert.strictEqual(value, 'usakli');
		});

		it('should return null if key is falsy', async function () {
			const data = await db.getObjectField(null, 'test');
			assert.strictEqual(data, null);
		});

		it('should return null and not error', async function () {
			const data = await db.getObjectField('hashTestObject', ['field1', 'field2']);
			assert.strictEqual(data, null);
		});
	});

	describe('getObjectFields()', () => {
		it('should return an object with falsy values', async function () {
			const object = await db.getObjectFields('doesnotexist', ['field1', 'field2']);
			assert.strictEqual(typeof object, 'object');
			assert.strictEqual(!!object.field1, false);
			assert.strictEqual(!!object.field2, false);
		});

		it('should return an object with correct fields', async function () {
			const object = await db.getObjectFields('hashTestObject', ['lastname', 'age', 'field1']);
			assert.strictEqual(object.lastname, 'usakli');
			assert.strictEqual(object.age, 99);
			assert.strictEqual(!!object.field1, false);
		});

		it('should return null if key is falsy', async function () {
			const data = await db.getObjectFields(null, ['test', 'foo']);
			assert.strictEqual(data, null);
		});
	});

	describe('getObjectsFields()', () => {
		before(async function () {
			await Promise.all([
				db.setObject('testObject8', { name: 'baris', age: 99 }),
				db.setObject('testObject9', { name: 'ginger', age: 3 }),
			]);
		});

		it('should return an array of objects with correct values', async function () {
			const objects = await db.getObjectsFields(['testObject8', 'testObject9', 'doesnotexist'], ['name', 'age']);
			assert(Array.isArray(objects));
			assert.strictEqual(objects.length, 3);
			assert.strictEqual(objects[0].name, 'baris');
			assert.strictEqual(objects[0].age, 99);
			assert.strictEqual(objects[1].name, 'ginger');
			assert.strictEqual(objects[1].age, 3);
			assert.strictEqual(!!objects[2].name, false);
		});

		it('should return undefined for all fields if object does not exist', async function () {
			const data = await db.getObjectsFields(['doesnotexist1', 'doesnotexist2'], ['name', 'age']);
			assert(Array.isArray(data));
			assert.strictEqual(data[0].name, null);
			assert.strictEqual(data[0].age, null);
			assert.strictEqual(data[1].name, null);
			assert.strictEqual(data[1].age, null);
		});

		it('should return all fields if fields is empty array', async function () {
			const objects = await db.getObjectsFields(['testObject8', 'testObject9', 'doesnotexist'], []);
			assert(Array.isArray(objects));
			assert.strictEqual(objects.length, 3);
			assert.strictEqual(objects[0].name, 'baris');
			assert.strictEqual(Number(objects[0].age), 99);
			assert.strictEqual(objects[1].name, 'ginger');
			assert.strictEqual(Number(objects[1].age), 3);
			assert.strictEqual(!!objects[2], false);
		});

		it('should return objects if fields is not an array', async function () {
			const objects = await db.getObjectsFields(['testObject8', 'testObject9', 'doesnotexist'], undefined);
			assert.strictEqual(objects[0].name, 'baris');
			assert.strictEqual(Number(objects[0].age), 99);
			assert.strictEqual(objects[1].name, 'ginger');
			assert.strictEqual(Number(objects[1].age), 3);
			assert.strictEqual(!!objects[2], false);
		});
	});

	describe('getObjectKeys()', () => {
		it('should return an empty array for a object that does not exist', async function () {
			const keys = await db.getObjectKeys('doesnotexist');
			assert(Array.isArray(keys) && keys.length === 0);
		});

		it('should return an array of keys for the object\'s fields', async function () {
			const keys = await db.getObjectKeys('hashTestObject');
			assert(Array.isArray(keys) && keys.length === 3);
			keys.forEach((key) => {
				assert.notStrictEqual(['name', 'lastname', 'age'].indexOf(key), -1);
			});
		});
	});

	describe('getObjectValues()', () => {
		it('should return an empty array for a object that does not exist', async function () {
			const values = await db.getObjectValues('doesnotexist');
			assert(Array.isArray(values) && values.length === 0);
		});

		it('should return an array of values for the object\'s fields', async function () {
			const values = await db.getObjectValues('hashTestObject');
			assert(Array.isArray(values) && values.length === 3);
			assert.deepStrictEqual(['baris', 'usakli', 99].sort(), values.sort());
		});
	});

	describe('isObjectField()', () => {
		it('should return false if object does not exist', async function () {
			const value = await db.isObjectField('doesnotexist', 'field1');
			assert.strictEqual(value, false);
		});

		it('should return false if field does not exist', async function () {
			const value = await db.isObjectField('hashTestObject', 'field1');
			assert.strictEqual(value, false);
		});

		it('should return true if field exists', async function () {
			const value = await db.isObjectField('hashTestObject', 'name');
			assert.strictEqual(value, true);
		});

		it('should not error if field is falsy', async function () {
			const value = await db.isObjectField('hashTestObjectEmpty', '');
			assert.strictEqual(value, false);
		});
	});

	describe('isObjectFields()', () => {
		it('should return an array of false if object does not exist', async function () {
			const values = await db.isObjectFields('doesnotexist', ['field1', 'field2']);
			assert.deepStrictEqual(values, [false, false]);
		});

		it('should return false if field does not exist', async function () {
			const values = await db.isObjectFields('hashTestObject', ['name', 'age', 'field1']);
			assert.deepStrictEqual(values, [true, true, false]);
		});

		it('should not error if one field is falsy', async function () {
			const values = await db.isObjectFields('hashTestObject', ['name', '']);
			assert.deepStrictEqual(values, [true, false]);
		});
	});

	describe('deleteObjectField()', () => {
		before(async function () {
			await db.setObject('testObject10', { foo: 'bar', delete: 'this', delete1: 'this', delete2: 'this' });
		});

		it('should delete an objects field', async function () {
			await db.deleteObjectField('testObject10', 'delete');
			const isField = await db.isObjectField('testObject10', 'delete');
			assert.strictEqual(isField, false);
		});

		it('should delete multiple fields of the object', async function () {
			await db.deleteObjectFields('testObject10', ['delete1', 'delete2']);
			const results = await Promise.all([
				db.isObjectField('testObject10', 'delete1'),
				db.isObjectField('testObject10', 'delete2'),
			]);
			assert.strictEqual(results[0], false);
			assert.strictEqual(results[1], false);
		});

		it('should delete multiple fields of multiple objects', async function () {
			await db.setObject('deleteFields1', { foo: 'foo1', baz: '2' });
			await db.setObject('deleteFields2', { foo: 'foo2', baz: '3' });
			await db.deleteObjectFields(['deleteFields1', 'deleteFields2'], ['baz']);
			const [obj1, obj2] = await db.getObjects(['deleteFields1', 'deleteFields2']);
			assert.deepStrictEqual(obj1, { foo: 'foo1' });
			assert.deepStrictEqual(obj2, { foo: 'foo2' });
		});

		it('should not error if fields is empty array', async function () {
			await db.deleteObjectFields('someKey', []);
			await db.deleteObjectField('someKey', []);
		});

		it('should not error if key is undefined', async function () {
			await db.deleteObjectField(undefined, 'someField');
		});

		it('should not error if key is null', async function () {
			await db.deleteObjectField(null, 'someField');
		});

		it('should not error if field is undefined', async function () {
			await db.deleteObjectField('someKey', undefined);
		});

		it('should not error if one of the fields is undefined', async function () {
			await db.deleteObjectFields('someKey', ['best', undefined]);
		});

		it('should not error if field is null', async function () {
			await db.deleteObjectField('someKey', null);
		});
	});

	describe('incrObjectField()', () => {
		before(async function () {
			await db.setObject('testObject11', { age: 99 });
		});

		it('should set an objects field to 1 if object does not exist', async function () {
			const newValue = await db.incrObjectField('testObject12', 'field1');
			assert.strictEqual(newValue, 1);
		});

		it('should increment an object fields by 1 and return it', async function () {
			const newValue = await db.incrObjectField('testObject11', 'age');
			assert.strictEqual(newValue, 100);
		});
	});

	describe('decrObjectField()', () => {
		before(async function () {
			await db.setObject('testObject13', { age: 99 });
		});

		it('should set an objects field to -1 if object does not exist', async function () {
			const newValue = await db.decrObjectField('testObject14', 'field1');
			assert.strictEqual(newValue, -1);
		});

		it('should decrement an object fields by 1 and return it', async function () {
			const newValue = await db.decrObjectField('testObject13', 'age');
			assert.strictEqual(newValue, 98);
		});

		it('should decrement multiple objects field by 1 and return an array of new values', async function () {
			const data = await db.decrObjectField(['testObject13', 'testObject14', 'decrTestObject'], 'age');
			assert.strictEqual(data[0], 97);
			assert.strictEqual(data[1], -1);
			assert.strictEqual(data[2], -1);
		});
	});

	describe('incrObjectFieldBy()', () => {
		before(async function () {
			await db.setObject('testObject15', { age: 100 });
		});

		it('should set an objects field to 5 if object does not exist', async function () {
			const newValue = await db.incrObjectFieldBy('testObject16', 'field1', 5);
			assert.strictEqual(newValue, 5);
		});

		it('should increment an object fields by passed in value and return it (type integer)', async function () {
			const newValue = await db.incrObjectFieldBy('testObject15', 'age', 11);
			assert.strictEqual(newValue, 111);
		});

		it('should increment an object fields by passed in value and return it (type string)', async function () {
			const newValue = await db.incrObjectFieldBy('testObject15', 'age', '11');
			assert.strictEqual(newValue, 122);
		});

		it('should return null if value is NaN', async function () {
			const newValue = await db.incrObjectFieldBy('testObject15', 'lastonline', 'notanumber');
			assert.strictEqual(newValue, null);
			const isField = await db.isObjectField('testObject15', 'lastonline');
			assert.strictEqual(isField, false);
		});
	});

	describe('incrObjectFieldByBulk', () => {
		before(async function () {
			await db.setObject('testObject16', { age: 100 });
		});

		it('should increment multiple object fields', async function () {
			await db.incrObjectFieldByBulk([
				['testObject16', { age: 5, newField: 10 }],
				['testObject17', { newField: -5 }],
			]);
			const d = await db.getObjects(['testObject16', 'testObject17']);
			assert.strictEqual(d[0].age, 105);
			assert.strictEqual(d[0].newField, 10);
			assert.strictEqual(d[1].newField, -5);
		});
	});
});