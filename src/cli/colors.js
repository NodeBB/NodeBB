'use strict';

// override commander help formatting functions
// to include color styling in the output
// so the CLI looks nice

const { Command, Help } = require('commander');

const colors = [
	// depth = 0, top-level command
	{
		command: 'yellow',
		option: 'cyan',
		arg: 'magenta',
	},
	// depth = 1, second-level commands
	{
		command: 'green',
		option: 'blue',
		arg: 'red',
	},
];

function humanReadableArgName(arg) {
	const nameOutput = arg.name + (arg.variadic === true ? '...' : '');

	return arg.required ? `<${nameOutput}>` : `[${nameOutput}]`;
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
			parentCmdNames = `${parentCmd.name()[colors[parentDepth].command]} ${parentCmdNames}`;

			parentCmd = parentCmd.parent;
			parentDepth -= 1;
		}

		// from Command.prototype.usage()
		const args = cmd._args.map(arg => humanReadableArgName(arg)[colors[depth].arg]);
		const cmdUsage = [].concat(
			(cmd.options.length || cmd._hasHelpOption ? '[options]'[colors[depth].option] : []),
			(cmd.commands.length ? '[command]'[colors[depth + 1].command] : []),
			(cmd._args.length ? args : [])
		).join(' ');

		return `${parentCmdNames}${cmdName[colors[depth].command]} ${cmdUsage}`;
	},
	subcommandTerm(cmd) {
		const depth = cmd.depth();

		// Legacy. Ignores custom usage string, and nested commands.
		const args = cmd._args.map(arg => humanReadableArgName(arg)).join(' ');
		return (cmd._name + (
			cmd._aliases[0] ? `|${cmd._aliases[0]}` : ''
		))[colors[depth].command] +
      (cmd.options.length ? ' [options]' : '')[colors[depth].option] + // simplistic check for non-help option
      (args ? ` ${args}` : '')[colors[depth].arg];
	},
	longestOptionTermLength(cmd, helper) {
		return Help.prototype.longestOptionTermLength.call(this, cmd, helper) + ''.red.length;
	},
	longestArgumentTermLength(cmd, helper) {
		return Help.prototype.longestArgumentTermLength.call(this, cmd, helper) + ''.red.length;
	},
	formatHelp(cmd, helper) {
		const depth = cmd.depth();

		const termWidth = helper.padWidth(cmd, helper);
		const helpWidth = helper.helpWidth || 80;
		const itemIndentWidth = 2;
		const itemSeparatorWidth = 2; // between term and description
		function formatItem(term, description) {
			if (description) {
				const fullText = `${term.padEnd(termWidth + itemSeparatorWidth)}${description}`;
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
			argument.term[colors[depth].arg],
			argument.description
		));
		if (argumentList.length > 0) {
			output = output.concat(['Arguments:', formatList(argumentList), '']);
		}

		// Options
		const optionList = helper.visibleOptions(cmd).map(option => formatItem(
			helper.optionTerm(option)[colors[depth].option],
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
