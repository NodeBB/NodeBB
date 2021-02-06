'use strict';


// override commander functions
// to include color styling in the output
// so the CLI looks nice

const { Command } = require('commander');

const commandColor = 'yellow';
const optionColor = 'cyan';
const argColor = 'magenta';
const subCommandColor = 'green';
const subOptionColor = 'blue';
const subArgColor = 'red';

Command.prototype.helpInformation = function () {
	let desc = [];
	if (this._description) {
		desc = [
			`  ${this._description}`,
			'',
		];
	}

	let cmdName = this._name;
	if (this._alias) {
		cmdName = `${cmdName} | ${this._alias}`;
	}
	const usage = [
		'',
		`  Usage: ${cmdName[commandColor]}${' '.reset}${this.usage()}`,
		'',
	];

	let cmds = [];
	const commandHelp = this.commandHelp();
	if (commandHelp) {
		cmds = [commandHelp];
	}

	const options = [
		'',
		'  Options:',
		'',
		`${this.optionHelp().replace(/^/gm, '    ')}`,
		'',
	];

	return usage
		.concat(desc)
		.concat(options)
		.concat(cmds)
		.join('\n'.reset);
};

function humanReadableArgName(arg) {
	const nameOutput = arg.name + (arg.variadic === true ? '...' : '');

	return arg.required ? `<${nameOutput}>` : `[${nameOutput}]`;
}

Command.prototype.usage = function () {
	const args = this._args.map(arg => humanReadableArgName(arg));

	const usage = '[options]'[optionColor] +
		(this.commands.length ? ' [command]' : '')[subCommandColor] +
		(this._args.length ? ` ${args.join(' ')}` : '')[argColor];

	return usage;
};

function pad(str, width) {
	const len = Math.max(0, width - str.length);
	return str + Array(len + 1).join(' ');
}

Command.prototype.commandHelp = function () {
	if (!this.commands.length) {
		return '';
	}

	const commands = this.commands.filter(cmd => !cmd._noHelp).map((cmd) => {
		const args = cmd._args.map(arg => humanReadableArgName(arg)).join(' ');

		return [
			`${cmd._name[subCommandColor] +
				(cmd._alias ? ` | ${cmd._alias}` : '')[subCommandColor] +
				(cmd.options.length ? ' [options]' : '')[subOptionColor]
			} ${args[subArgColor]}`,
			cmd._description,
		];
	});

	const width = commands.reduce((max, command) => Math.max(max, command[0].length), 0);

	return [
		'',
		'  Commands:',
		'',
		commands.map((cmd) => {
			const desc = cmd[1] ? `  ${cmd[1]}` : '';
			return pad(cmd[0], width) + desc;
		}).join('\n').replace(/^/gm, '    '),
		'',
	].join('\n');
};

Command.prototype.optionHelp = function () {
	const width = this.largestOptionLength();

	// Append the help information
	return this.options
		.map(option => `${pad(option.flags, width)[optionColor]}  ${option.description}`)
		.concat([`${pad('-h, --help', width)[optionColor]}  output usage information`])
		.join('\n');
};
