'use strict';

// todo: replace with styleText from node:util in node 20+
const chalk = require('chalk');

// https://github.com/tj/commander.js/blob/master/examples/color-help.mjs
module.exports = {
	styleTitle: str => chalk.bold(str),
	styleCommandText: str => chalk.cyan(str),
	styleCommandDescription: str => chalk.magenta(str),
	styleDescriptionText: str => chalk.italic(str),
	styleOptionText: str => chalk.green(str),
	styleArgumentText: str => chalk.yellow(str),
	styleSubcommandText: str => chalk.blue(str),
};
