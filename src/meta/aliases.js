'use strict';

const _ = require('lodash');

const aliases = {
	'plugin static dirs': ['staticdirs'],
	'requirejs modules': ['rjs', 'modules'],
	'client js bundle': ['clientjs', 'clientscript', 'clientscripts'],
	'admin js bundle': ['adminjs', 'adminscript', 'adminscripts'],
	javascript: ['js'],
	'client side styles': [
		'clientcss', 'clientless', 'clientstyles', 'clientstyle',
	],
	'admin control panel styles': [
		'admincss', 'adminless', 'adminstyles', 'adminstyle', 'acpcss', 'acpless', 'acpstyles', 'acpstyle',
	],
	styles: ['css', 'less', 'style'],
	templates: ['tpl'],
	languages: ['lang', 'i18n'],
};

exports.aliases = aliases;

function buildTargets() {
	var length = 0;
	var output = Object.keys(aliases).map((name) => {
		var arr = aliases[name];
		if (name.length > length) {
			length = name.length;
		}

		return [name, arr.join(', ')];
	}).map(tuple => `     ${_.padEnd(`"${tuple[0]}"`, length + 2).magenta}  |  ${tuple[1]}`).join('\n');
	console.log(
		`\n\n  Build targets:\n${
			(`\n     ${_.padEnd('Target', length + 2)}  |  Aliases`).green
		}${'\n     ------------------------------------------------------\n'.blue
		}${output}\n`
	);
}

exports.buildTargets = buildTargets;
