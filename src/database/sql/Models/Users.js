"use strict";

var winston = require('winston');

module.exports = function(knex, bookshelf, module) {

	var User = bookshelf.Model.extend({
		tableName: 'users'
	});

};