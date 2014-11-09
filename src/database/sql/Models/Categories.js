"use strict";

var winston = require('winston');

module.exports = function(knex, bookshelf, module) {

	var Category = bookshelf.Model.extend({
		tableName: 'categories'
	});

};