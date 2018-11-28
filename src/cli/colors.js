'use strict';


// override commander functions
// to include color styling in the output
// so the CLI looks nice

var Command = require('commander').Command;

var commandColor = 'yellow';
var optionColor = 'cyan';
var argColor = 'magenta';
var subCommandColor = 'green';
var subOptionColor = 'blue';
var subArgColor = 'red';

Command.prototype.helpInformation = function () {
	var desc = [];
	if (this._description) {
		desc = [
			'  ' + this._description,
			'',
		];
	}

	var cmdName = this._name;
	if (this._alias) {
		cmdName = cmdName + ' | ' + this._alias;
	}
	var usage = [
		'',
		'  Usage: ' + cmdName[commandColor] + ' '.reset + this.usage(),
		'',
	];

	var cmds = [];
	var commandHelp = this.commandHelp();
	if (commandHelp) {
		cmds = [commandHelp];
	}

	var options = [
		'',
		'  Options:',
		'',
		'' + this.optionHelp().replace(/^/gm, '    '),
		'',
	];

	return usage
		.concat(desc)
		.concat(options)
		.concat(cmds)
		.join('\n'.reset);
};

function humanReadableArgName(arg) {
	var nameOutput = arg.name + (arg.variadic === true ? '...' : '');

	return arg.required ? '<' + nameOutput + '>' : '[' + nameOutput + ']';
}

Command.prototype.usage = function () {
	var args = this._args.map(function (arg) {
		return humanReadableArgName(arg);
	});

	var usage = '[options]'[optionColor] +
		(this.commands.length ? ' [command]' : '')[subCommandColor] +
		(this._args.length ? ' ' + args.join(' ') : '')[argColor];

	return usage;
};

function pad(str, width) {
	var len = Math.max(0, width - str.length);
	return str + Array(len + 1).join(' ');
}

Command.prototype.commandHelp = function () {
	if (!this.commands.length) {
		return '';
	}

	var commands = this.commands.filter(function (cmd) {
		return !cmd._noHelp;
	}).map(function (cmd) {
		var args = cmd._args.map(function (arg) {
			return humanReadableArgName(arg);
		}).join(' ');

		return [
			cmd._name[subCommandColor] +
				(cmd._alias ? ' | ' + cmd._alias : '')[subCommandColor] +
				(cmd.options.length ? ' [options]' : '')[subOptionColor] +
				' ' + args[subArgColor],
			cmd._description,
		];
	});

	var width = commands.reduce(function (max, command) {
		return Math.max(max, command[0].length);
	}, 0);

	return [
		'',
		'  Commands:',
		'',
		commands.map(function (cmd) {
			var desc = cmd[1] ? '  ' + cmd[1] : '';
			return pad(cmd[0], width) + desc;
		}).join('\n').replace(/^/gm, '    '),
		'',
	].join('\n');
};

Command.prototype.optionHelp = function () {
	var width = this.largestOptionLength();

	// Append the help information
	return this.options
		.map(function (option) {
			return pad(option.flags, width)[optionColor] + '  ' + option.description;
		})
		.concat([pad('-h, --help', width)[optionColor] + '  output usage information'])
		.join('\n');
};
