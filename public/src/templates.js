"use strict";

(function(module) {
	var templates = {
			cache: {}
		},
		helpers = {},
		globals = {},
		loader,
		originalObj;

	templates.parse = function(template, obj, bind, callback) {
		if (typeof bind === 'function') {
			callback = bind;
			bind = false;
		}

		obj = registerGlobals(obj || {});
		bind = bind ? Math.random() : false;

		if (bind) {
			obj.__template = template;
		}

		if (loader && callback) {
			if (!templates.cache[template]) {
				loader(template, function(err, loaded) {
					if (loaded) {
						templates.cache[template] = loaded;
					}

					callback(err, parse(loaded, obj, bind));
				});	
			} else {
				callback(null, parse(templates.cache[template], obj, bind));
			}
		} else {
			return parse(template, obj, bind);
		}
	};

	templates.registerHelper = function(name, func) {
		helpers[name] = func;
	};

	templates.registerLoader = function(func) {
		loader = func;
	};

	templates.setGlobal = function(key, value) {
		globals[key] = value;
	};

	templates.getBlock = function(template, block) {
		return template.replace(new RegExp("[\\s\\S]*<!--[\\s]*BEGIN " + block + "[\\s]*-->[\r\n]*([\\s\\S]*?)[\r\n]*<!--[\\s]*END " + block + "[\\s]*-->[\\s\\S]*", 'g'), '$1');
	};

	function express(filename, options, fn) {
		var fs = require('fs'),
			tpl = filename.replace(options.settings.views + '/', '');

		if (!templates.cache[tpl]) {
			fs.readFile(filename, function(err, html) {
				templates.cache[tpl] = html.toString();
				return fn(err, templates.parse(templates.cache[tpl], options));
			});
		} else {
			return fn(null, templates.parse(templates.cache[tpl], options));
		}
	}

	function replace(template, key, value) {
		var searchRegex = new RegExp('{' + key + '}', 'g');
		return template.replace(searchRegex, value);
	}

	function makeRegex(block) {
		return new RegExp("<!--[\\s]*BEGIN " + block + "[\\s]*-->[\\s\\S]*<!--[\\s]*END " + block + "[\\s]*-->", 'g');
	}

	function makeConditionalRegex(block) {
		return new RegExp("<!--[\\s]*IF " + block + "[\\s]*-->([\\s\\S]*?)<!--[\\s]*ENDIF " + block + "[\\s]*-->", 'g');
	}

	function makeStatementRegex(key) {
		return new RegExp("([\\s]*<!--[\\s]*IF " + key + "[\\s]*-->[\\s]*)|([\\s]*<!--[\\s]*ENDIF " + key + "[\\s]*-->[\\s]*)", 'gi');
	}

	function registerGlobals(obj) {
		for (var g in globals) {
			if (globals.hasOwnProperty(g)) {
				obj[g] = obj[g] || globals[g];
			}
		}

		return obj;
	}

	function checkConditional(template, key, value) {
		var conditional = makeConditionalRegex(key),
			matches = template.match(conditional);

		if (matches !== null) {
			for (var i = 0, ii = matches.length; i < ii; i++) {
				var conditionalBlock = matches[i].split(/\s*<!-- ELSE -->\s*/),
					statement = makeStatementRegex(key);

				if (conditionalBlock[1]) {
					// there is an else statement
					if (!value) {
						template = template.replace(matches[i], conditionalBlock[1].replace(statement, '').replace(/(^[\s]*)|([\s]*$)/gi, ''));
					} else {
						template = template.replace(matches[i], conditionalBlock[0].replace(statement, '').replace(/(^[\s]*)|([\s]*$)/gi, ''));
					}
				} else {
					// regular if statement
					if (!value) {
						template = template.replace(matches[i], '');
					} else {
						template = template.replace(matches[i], matches[i].replace(statement, '').replace(/(^[\s]*)|([\s]*$)/gi, ''));
					}
				}
			}
		}

		return template;
	}

	function callMethod(method, parameters) {
		return method.apply(templates, [parameters.data, parameters.iterator, parameters.numblocks]);
	}

	function parseFunctions(block, result, parameters) {
		var functions = block.match(/{function.*?}/gi, '');
		for (var fn in functions) {
			if (functions.hasOwnProperty(fn)) {
				var func = functions[fn],
					method = functions[fn].split('.').pop().split('}').shift();

				if (helpers[method]) {
					result = result.replace(new RegExp(func, 'gi'), callMethod(helpers[method], parameters));
				}
			}
		}

		return result;
	}

	function parseArray(template, array, key, namespace, bind) {
		template = checkConditional(template, namespace + 'length', array[key].length);
		template = checkConditional(template, '!' + namespace + 'length', !array[key].length);

		var regex = makeRegex(key),
			block = templates.getBlock(template, namespace.substring(0, namespace.length - 1));

		if (typeof block === "undefined") {
			return template;
		}

		var numblocks = array[key].length - 1,
			iterator = 0,
			result = "",
			parsedBlock;

		do {
			parsedBlock = parse(block, array[key][iterator], bind, namespace, {iterator: iterator, total: numblocks}) + ((iterator < numblocks) ? '\r\n':'');
			
			result += (!bind) ? parsedBlock : '<span data-binding="' + bind + namespace + iterator + '">' + parsedBlock + '</span>';
			result = parseFunctions(block, result, {
				data: array[key][iterator],
				iterator: iterator,
				numblocks: numblocks // seems unnecessary
			});

			if (bind) {
				array[key][iterator].__template = block;
			}
		} while (iterator++ < numblocks);

		return template.replace(regex, result);
	}

	function parseValue(template, key, value, blockInfo) {
		value = typeof value === 'string' ? value.replace(/^\s+|\s+$/g, '') : value;

		template = checkConditional(template, key, value);
		template = checkConditional(template, '!' + key, !value);

		if (blockInfo) {
			template = checkConditional(template, '@first', blockInfo.iterator === 0);
			template = checkConditional(template, '!@first', blockInfo.iterator !== 0);
			template = checkConditional(template, '@last', blockInfo.iterator === blockInfo.total);
			template = checkConditional(template, '!@last', blockInfo.iterator !== blockInfo.total);
		}

		return replace(template, key, value);
	}

	function setupBindings(parameters) {
		var obj = parameters.obj,
			key = parameters.key,
			namespace = parameters.namespace,
			blockInfo = parameters.blockInfo,
			bind = parameters.bind,
			template = parameters.template,
			value = obj[key];

		obj.__namespace = namespace;
		obj.__iterator = blockInfo ? blockInfo.iterator : false;

		Object.defineProperty(obj, key, {
			get: function() {
				return this['__' + key];
			},
			set: function(value) {
				this['__' + key] = value;

				var els = document.querySelectorAll('[data-binding="' + (this.__iterator !== false ? (bind + this.__namespace + this.__iterator) : bind) + '"]');
				
				for (var el in els) {
					if (els.hasOwnProperty(el)) {
						if (this.__parent) {
							var parent = this.__parent();
							els[el].innerHTML = parse(parent.template, parent.data, false);
						} else {
							els[el].innerHTML = parse(this.__template, obj, false, this.__namespace);	
						}
					}
				}
			}
		});

		obj[key] = value;
	}

	function defineParent(obj, parent) {
		obj.__parent = function() {
			return {
				data: parent,
				template: parent.__template
			};
		};
	}

	function parse(template, obj, bind, namespace, blockInfo) {
		if (!obj || obj.length === 0) {
			template = '';
		}

		namespace = namespace || '';
		originalObj = originalObj || obj;

		for (var key in obj) {
			if (obj.hasOwnProperty(key)) {
				if (typeof obj[key] === 'undefined' || typeof obj[key] === 'function') {
					continue;
				} else if (obj[key] === null) {
					template = replace(template, namespace + key, '');
				} else if (obj[key].constructor === Array) {
					template = parseArray(template, obj, key, namespace + key + '.', bind);
				} else if (obj[key] instanceof Object) {
					defineParent(obj[key], originalObj);
					template = parse(template, obj[key], bind, namespace + key + '.');
				} else {
					template = parseValue(template, namespace + key, obj[key], blockInfo);
					
					if (bind && obj[key]) {
						setupBindings({
							obj: obj,
							key: key,
							namespace: namespace,
							blockInfo: blockInfo,
							bind: bind,
							template: template
						});
					}
				}
			}
		}

		if (namespace) {
			template = template.replace(new RegExp("{" + namespace + "[\\s\\S]*?}", 'g'), '');
			namespace = '';
		} else {
			// clean up all undefined conditionals
			template = template.replace(/\s*<!-- ELSE -->\s*/gi, 'ENDIF -->\r\n')
								.replace(/\s*<!-- IF([\s\S]*?)ENDIF([\s\S]*?)-->/gi, '')
								.replace(/\s*<!-- ENDIF ([\s\S]*?)-->\s*/gi, '');

			if (bind) {
				template = '<span data-binding="' + bind + '">' + template + '</span>';
			}
		}

		return template;
	}

	module.exports = templates;
	module.exports.__express = express;

	if ('undefined' !== typeof window) {
		window.templates = module.exports;
	}

})('undefined' === typeof module ? {
	module: {
		exports: {}
	}
} : module);



/*
"use strict";


(function (module) {

	var config = {},
		templates,
		fs = null,
		path = null,
		available_templates = [],
		parsed_variables = {},
		apiXHR;

	module.exports = templates = {
		"globals": {}
	};

	templates.force_refresh = function(tpl) {
		return !!config.force_refresh[tpl];
	};

	templates.get_custom_map = function(tpl) {
		if (config.custom_mapping && tpl) {
			for (var pattern in config.custom_mapping) {
				if (tpl.match(pattern)) {
					return (config.custom_mapping[pattern]);
				}
			}
		}

		return false;
	};

	templates.is_available = function(tpl) {
		return $.inArray(tpl + '.tpl', available_templates) !== -1;
	};

	templates.prepare = function(raw_tpl) {
		var template = {};
		template.html = raw_tpl;
		template.parse = parse;
		template.blocks = {};

		return template;
	};

	templates.render = function(filename, options, fn) {
		var fs = require('fs'),
			path = require('path');

		if ('function' === typeof options) {
			fn = options, options = false;
		}

		var tpl = filename
			.replace(path.join(__dirname + '/../templates/'), '')
			.replace('.' + options.settings['view engine'], '');

		if (!templates[tpl]) {
			fs.readFile(filename, function(err, html) {
				templates[tpl] = templates.prepare(html.toString());

				return fn(err, templates[tpl].parse(options));
			});
		} else {
			return fn(null, templates[tpl].parse(options));
		}
	};

	templates.preload_template = function(tpl_name, callback) {
		if(templates[tpl_name]) {
			return callback();
		}

		// TODO: This should be "load_template", and the current load_template
		// should be named something else
		// TODO: The "Date.now()" in the line below is only there for development purposes.
		// It should be removed at some point.
		$.get(RELATIVE_PATH + '/templates/' + tpl_name + '.tpl?v=' + Date.now(), function(html) {
			var template = function() {
				this.toString = function() {
					return this.html;
				};
			};

			template.prototype.parse = parse;
			template.prototype.html = String(html);
			template.prototype.blocks = {};

			templates[tpl_name] = new template;

			callback();
		});
	};

	templates.load_template = function(callback, url, template) {
		var location = document.location || window.location,
			api_url = (url === '' || url === '/') ? 'home' : url,
			tpl_url = templates.get_custom_map(api_url.split('?')[0]);

		if (!tpl_url) {
			tpl_url = ajaxify.getTemplateMapping(api_url);
		}

		var template_data = null;

		if (!templates[tpl_url]) {
			templates.preload_template(tpl_url, function() {
				parse_template();
			});
		} else {
			parse_template();
		}

		apiXHR = $.ajax({
			url: RELATIVE_PATH + '/api/' + api_url,
			cache: false,
			success: function(data) {
				if (!data) {
					ajaxify.go('404');
					return;
				}

				template_data = data;
				parse_template();
			},
			error: function(data, textStatus) {
				$('#content, #footer').stop(true, true).removeClass('ajaxifying');
				if (data && data.status == 404) {
					return ajaxify.go('404');
				} else if (data && data.status === 403) {
					return ajaxify.go('403');
				} else if (textStatus !== "abort") {
					app.alertError(data.responseJSON.error);
				}
			}
		});

		function parse_template() {
			if (!templates[tpl_url] || !template_data) {
				return;
			}

			template_data.relative_path = RELATIVE_PATH;

			var template = templates[tpl_url].parse(template_data);

			translator.translate(template, function(translatedTemplate) {
				$('#content').html(translatedTemplate);

				templates.parseTemplateVariables();

				if (callback) {
					callback(true);
				}
			});
		}
	};

	templates.parseTemplateVariables = function() {
		$('#content [template-variable]').each(function(index, element) {
			var value = null;

			switch ($(element).attr('template-type')) {
				case 'boolean':
					value = ($(element).val() === 'true' || $(element).val() === '1') ? true : false;
					break;
				case 'int':
				case 'integer':
					value = parseInt($(element).val());
					break;
				default:
					value = $(element).val();
					break;
			}

			templates.set($(element).attr('template-variable'), value);
		});
	};

	templates.cancelRequest = function() {
		if (apiXHR) {
			apiXHR.abort();
		}
	};

	templates.flush = function() {
		parsed_variables = {};
	};

	templates.get = function(key) {
		return parsed_variables[key];
	};

	templates.set = function(key, value) {
		parsed_variables[key] = value;
	};

	templates.setGlobal = function(key, value) {
		templates.globals[key] = value;
	};

	//modified from https://github.com/psychobunny/dcp.templates
	var parse = function(data) {
		var self = this;

		function replace(key, value, template) {
			var searchRegex = new RegExp('{' + key + '}', 'g');
			return template.replace(searchRegex, value);
		}

		function makeRegex(block) {
			return new RegExp("<!--[\\s]*BEGIN " + block + "[\\s]*-->[\\s\\S]*?<!--[\\s]*END " + block + "[\\s]*-->", 'g');
		}

		function makeConditionalRegex(block) {
			return new RegExp("<!--[\\s]*IF " + block + "[\\s]*-->([\\s\\S]*?)<!--[\\s]*ENDIF " + block + "[\\s]*-->", 'g');
		}

		function getBlock(regex, block, template) {
			data = template.match(regex);
			if (data == null) {
				return;
			}

			if (self.blocks && block !== undefined) {
				self.blocks[block] = data[0];
			}

			var begin = new RegExp("(\r\n)*<!-- BEGIN " + block + " -->(\r\n)*", "g"),
				end = new RegExp("(\r\n)*<!-- END " + block + " -->(\r\n)*", "g");

			return data[0]
				.replace(begin, "")
				.replace(end, "");
		}

		function setBlock(regex, block, template) {
			return template.replace(regex, block);
		}

		var template = this.html,
			regex, block;

		for (var g in templates.globals) {
			if (templates.globals.hasOwnProperty(g)) {
				data[g] = data[g] || templates.globals[g];
			}
		}

		return (function parse(data, namespace, template, blockInfo) {
			if (!data || data.length == 0) {
				template = '';
			}

			function checkConditional(key, value) {
				var conditional = makeConditionalRegex(key),
					matches = template.match(conditional);

				if (matches !== null) {
					for (var i = 0, ii = matches.length; i < ii; i++) {
						var conditionalBlock = matches[i].split(/<!-- ELSE -->/);

						var statement = new RegExp("(<!--[\\s]*IF " + key + "[\\s]*-->)|(<!--[\\s]*ENDIF " + key + "[\\s]*-->)", 'gi');

						if (conditionalBlock[1]) {
							// there is an else statement
							if (!value) {
								template = template.replace(matches[i], conditionalBlock[1].replace(statement, ''));
							} else {
								template = template.replace(matches[i], conditionalBlock[0].replace(statement, ''));
							}
						} else {
							// regular if statement
							if (!value) {
								template = template.replace(matches[i], '');
							} else {
								template = template.replace(matches[i], matches[i].replace(statement, ''));
							}
						}
					}
				}
			}

			for (var d in data) {
				if (data.hasOwnProperty(d)) {
					if (typeof data[d] === 'undefined') {
						continue;
					} else if (data[d] === null) {
						template = replace(namespace + d, '', template);
					} else if (data[d].constructor == Array) {
						checkConditional(namespace + d + '.length', data[d].length);
						checkConditional('!' + namespace + d + '.length', !data[d].length);

						namespace += d + '.';

						var regex = makeRegex(d),
							block = getBlock(regex, namespace.substring(0, namespace.length - 1), template);

						if (block == null) {
							namespace = namespace.replace(d + '.', '');
							continue;
						}

						var numblocks = data[d].length - 1,
							i = 0,
							result = "";

						do {
							result += parse(data[d][i], namespace, block, {iterator: i, total: numblocks});
						} while (i++ < numblocks);

						namespace = namespace.replace(d + '.', '');
						template = setBlock(regex, result, template);
					} else if (data[d] instanceof Object) {
						template = parse(data[d], namespace + d + '.', template);
					} else {
						var key = namespace + d,
							value = typeof data[d] === 'string' ? data[d].replace(/^\s+|\s+$/g, '') : data[d];

						checkConditional(key, value);
						checkConditional('!' + key, !value);

						if (blockInfo && blockInfo.iterator) {
							checkConditional('@first', blockInfo.iterator === 0);
							checkConditional('!@first', blockInfo.iterator !== 0);
							checkConditional('@last', blockInfo.iterator === blockInfo.total);
							checkConditional('!@last', blockInfo.iterator !== blockInfo.total);
						}

						template = replace(key, value, template);
					}
				}
			}

			if (namespace) {
				template = template.replace(new RegExp("{" + namespace + "[\\s\\S]*?}", 'g'), '');
				namespace = '';
			} else {
				// clean up all undefined conditionals
				template = template.replace(/<!-- ELSE -->/gi, 'ENDIF -->')
									.replace(/<!-- IF([^@]*?)ENDIF([^@]*?)-->/gi, '')
									.replace(/<!-- ENDIF ([^@]*?)-->/gi, '');
			}

			return template;

		})(data, "", template);
	};

	module.exports.__express = module.exports.render;

	if ('undefined' !== typeof window) {
		window.templates = module.exports;

		window.onload = function() {
			$.when($.getJSON(RELATIVE_PATH + '/templates/config.json'), $.getJSON(RELATIVE_PATH + '/api/get_templates_listing')).done(function (config_data, templates_data) {
				config = config_data[0];
				available_templates = templates_data[0];

				app.load();
			});
		};
	}

})('undefined' === typeof module ? {
	module: {
		exports: {}
	}
} : module);
*/