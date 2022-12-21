'use strict';

// override commander help formatting functions
// to include color styling in the output
// so the CLI looks nice

const { Command } = require('commander');
const chalk = require('chalk');

const colors = [
	// depth = 0, top-level command
	{ command: 'yellow', option: 'cyan', arg: 'magenta' },
	// depth = 1, second-level commands
	{ command: 'green', option: 'blue', arg: 'red' },
	// depth = 2, third-level commands
	{ command: 'yellow', option: 'cyan', arg: 'magenta' },
	// depth = 3 fourth-level commands
	{ command: 'green', option: 'blue', arg: 'red' },
];

function humanReadableArgName(arg) {
	const nameOutput = arg.name() + (arg.variadic === true ? '...' : '');

	return arg.required ? `<${nameOutput}>` : `[${nameOutput}]`;
}

function getControlCharacterSpaces(term) {
	const matches = term.match(/.\[\d+m/g);
	return matches ? matches.length * 5 : 0;
}

// get depth of command
// 0 = top, 1 = subcommand of top, etc
Command.prototype.depth = function () {
	if (this._depth === undefined) {
		let depth = 0;
		let { parent } = this;
		while (parent) { depth += 1; parent = parent.parent; }

		this._depth = depth;
	}
	return this._depth;
};

module.exports = {
	commandUsage(cmd) {
		const depth = cmd.depth();

		// Usage
		let cmdName = cmd._name;
		if (cmd._aliases[0]) {
			cmdName = `${cmdName}|${cmd._aliases[0]}`;
		}
		let parentCmdNames = '';
		let parentCmd = cmd.parent;
		let parentDepth = depth - 1;
		while (parentCmd) {
			parentCmdNames = `${chalk[colors[parentDepth].command](parentCmd.name())} ${parentCmdNames}`;

			parentCmd = parentCmd.parent;
			parentDepth -= 1;
		}

		// from Command.prototype.usage()
		const args = cmd._args.map(arg => chalk[colors[depth].arg](humanReadableArgName(arg)));
		const cmdUsage = [].concat(
			(cmd.options.length || cmd._hasHelpOption ? chalk[colors[depth].option]('[options]') : []),
			(cmd.commands.length ? chalk[colors[depth + 1].command]('[command]') : []),
			(cmd._args.length ? args : [])
		).join(' ');

		return `${parentCmdNames}${chalk[colors[depth].command](cmdName)} ${cmdUsage}`;
	},
	subcommandTerm(cmd) {
		const depth = cmd.depth();

		// Legacy. Ignores custom usage string, and nested commands.
		const args = cmd._args.map(arg => humanReadableArgName(arg)).join(' ');
		return chalk[colors[depth].command](cmd._name + (
			cmd._aliases[0] ? `|${cmd._aliases[0]}` : ''
		)) +
		chalk[colors[depth].option](cmd.options.length ? ' [options]' : '') + // simplistic check for non-help option
		chalk[colors[depth].arg](args ? ` ${args}` : '');
	},
	longestOptionTermLength(cmd, helper) {
		return helper.visibleOptions(cmd).reduce((max, option) => Math.max(
			max,
			helper.optionTerm(option).length - getControlCharacterSpaces(helper.optionTerm(option))
		), 0);
	},
	longestSubcommandTermLength(cmd, helper) {
		return helper.visibleCommands(cmd).reduce((max, command) => Math.max(
			max,
			helper.subcommandTerm(command).length - getControlCharacterSpaces(helper.subcommandTerm(command))
		), 0);
	},
	longestArgumentTermLength(cmd, helper) {
		return helper.visibleArguments(cmd).reduce((max, argument) => Math.max(
			max,
			helper.argumentTerm(argument).length - getControlCharacterSpaces(helper.argumentTerm(argument))
		), 0);
	},
	formatHelp(cmd, helper) {
		const depth = cmd.depth();

		const termWidth = helper.padWidth(cmd, helper);
		const helpWidth = helper.helpWidth || 80;
		const itemIndentWidth = 2;
		const itemSeparatorWidth = 2; // between term and description
		function formatItem(term, description) {
			const padding = ' '.repeat((termWidth + itemSeparatorWidth) - (term.length - getControlCharacterSpaces(term)));
			if (description) {
				const fullText = `${term}${padding}${description}`;
				return helper.wrap(fullText, helpWidth - itemIndentWidth, termWidth + itemSeparatorWidth);
			}
			return term;
		}
		function formatList(textArray) {
			return textArray.join('\n').replace(/^/gm, ' '.repeat(itemIndentWidth));
		}

		// Usage
		let output = [`Usage: ${helper.commandUsage(cmd)}`, ''];

		// Description
		const commandDescription = helper.commandDescription(cmd);
		if (commandDescription.length > 0) {
			output = output.concat([commandDescription, '']);
		}

		// Arguments
		const argumentList = helper.visibleArguments(cmd).map(argument => formatItem(
			chalk[colors[depth].arg](argument.term),
			argument.description
		));
		if (argumentList.length > 0) {
			output = output.concat(['Arguments:', formatList(argumentList), '']);
		}

		// Options
		const optionList = helper.visibleOptions(cmd).map(option => formatItem(
			chalk[colors[depth].option](helper.optionTerm(option)),
			helper.optionDescription(option)
		));
		if (optionList.length > 0) {
			output = output.concat(['Options:', formatList(optionList), '']);
		}

		// Commands
		const commandList = helper.visibleCommands(cmd).map(cmd => formatItem(
			helper.subcommandTerm(cmd),
			helper.subcommandDescription(cmd)
		));
		if (commandList.length > 0) {
			output = output.concat(['Commands:', formatList(commandList), '']);
		}

		return output.join('\n');
	},
};
