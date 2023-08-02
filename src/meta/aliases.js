'use strict';

const _ = require('lodash');
const chalk = require('chalk');

const aliases = {
	'plugin static dirs': ['staticdirs'],
	'requirejs modules': ['rjs', 'modules'],
	'client js bundle': ['clientjs', 'clientscript', 'clientscripts'],
	'admin js bundle': ['adminjs', 'adminscript', 'adminscripts'],
	javascript: ['js'],
	'client side styles': [
		'clientcss', 'clientscss', 'clientstyles', 'clientstyle',
	],
	'admin control panel styles': [
		'admincss', 'adminscss', 'adminstyles', 'adminstyle', 'acpcss', 'acpscss', 'acpstyles', 'acpstyle',
	],
	styles: ['css', 'scss', 'style'],
	templates: ['tpl'],
	languages: ['lang', 'i18n'],
};

exports.aliases = aliases;

function buildTargets() {
	let length = 0;
	const output = Object.keys(aliases).map((name) => {
		const arr = aliases[name];
		if (name.length > length) {
			length = name.length;
		}

		return [name, arr.join(', ')];
	}).map(tuple => `     ${chalk.magenta(_.padEnd(`"${tuple[0]}"`, length + 2))}  |  ${tuple[1]}`).join('\n');
	process.stdout.write(
		'\n\n  Build targets:\n' +
		`${chalk.green(`\n     ${_.padEnd('Target', length + 2)}  |  Aliases`)}` +
		`${chalk.blue('\n     ------------------------------------------------------\n')}` +
		`${output}\n\n`
	);
}

exports.buildTargets = buildTargets;
