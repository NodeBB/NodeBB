'use strict';

/* globals define */

define('composer/formatting', ['composer/controls', 'composer/preview'], function(controls, preview) {

	var formatting = {};

	var formattingDispatchTable = {
		'picture': function(){
			$('#files').click();
		},

		upload: function(){
			$('#files').click();
		},

		tags: function() {
			$('.tags-container').toggleClass('hidden');
		}
	};

	var buttons = [];

	formatting.addComposerButtons = function() {
		for(var x=0,numButtons=buttons.length;x<numButtons;x++) {
			$('.formatting-bar .btn-group form').before('<span class="btn btn-link" tabindex="-1" data-format="' + buttons[x].name + '"><i class="' + buttons[x].iconClass + '"></i></span>');
		}
	};

	formatting.addButton = function(iconClass, onClick) {
		var name = iconClass.replace('fa fa-', '');

		formattingDispatchTable[name] = onClick;
		buttons.push({
			name: name,
			iconClass: iconClass
		});
	};

	formatting.addButtonDispatch = function(name, onClick) {
		formattingDispatchTable[name] = onClick;
	};

	formatting.addHandler = function(postContainer) {
		postContainer.on('click', '.formatting-bar span', function () {
			var format = $(this).attr('data-format'),
				textarea = $(this).parents('.composer').find('textarea')[0];

			if(formattingDispatchTable.hasOwnProperty(format)){
				formattingDispatchTable[format](textarea, textarea.selectionStart, textarea.selectionEnd);
				preview.render(postContainer);
			}
		});
	};

	return formatting;
});
