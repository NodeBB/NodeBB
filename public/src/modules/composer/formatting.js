'use strict';

/* globals define */

define('composer/formatting', ['composer/controls', 'composer/preview'], function(controls, preview) {

	var formatting = {};

	var formattingDispatchTable = {
		'picture-o': function(){
			$('#files').click();
		},

		upload: function(){
			$('#files').click();
		},

		tags: function() {
			$('.tags-container').toggleClass('hidden');
		}
	};

	var customButtons = [];

	formatting.addComposerButtons = function() {
		for(var x=0,numButtons=customButtons.length;x<numButtons;x++) {
			$('.formatting-bar .btn-group form').before('<span class="btn btn-link" tabindex="-1" data-format="' + customButtons[x].name + '"><i class="' + customButtons[x].iconClass + '"></i></span>');
		}
	};

	formatting.addButton = function(iconClass, onClick) {
		var name = iconClass.replace('fa fa-', '');

		formattingDispatchTable[name] = onClick;
		customButtons.push({
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
			console.log('handling', format);

			console.log(formattingDispatchTable);

			if(formattingDispatchTable.hasOwnProperty(format)){
				formattingDispatchTable[format](textarea, textarea.selectionStart, textarea.selectionEnd);
				preview.render(postContainer);
			}
		});
	};

	return formatting;
});
