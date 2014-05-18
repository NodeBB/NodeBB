'use strict';

/* globals define */

define(['composer/controls'], function(controls) {

	var formatting = {};

	var formattingDispatchTable = {
		'fa fa-bold': function(textarea, selectionStart, selectionEnd){
			if(selectionStart === selectionEnd){
				controls.insertIntoTextarea(textarea, '**bolded text**');
				controls.updateTextareaSelection(textarea, selectionStart + 2, selectionStart + 13);
			} else {
				controls.wrapSelectionInTextareaWith(textarea, '**');
				controls.updateTextareaSelection(textarea, selectionStart + 2, selectionEnd + 2);
			}
		},

		'fa fa-italic': function(textarea, selectionStart, selectionEnd){
			if(selectionStart === selectionEnd){
				controls.insertIntoTextarea(textarea, "*italicised text*");
				controls.updateTextareaSelection(textarea, selectionStart + 1, selectionStart + 16);
			} else {
				controls.wrapSelectionInTextareaWith(textarea, '*');
				controls.updateTextareaSelection(textarea, selectionStart + 1, selectionEnd + 1);
			}
		},

		'fa fa-list': function(textarea, selectionStart, selectionEnd){
			if(selectionStart === selectionEnd){
				controls.insertIntoTextarea(textarea, "\n* list item");

				// Highlight "list item"
				controls.updateTextareaSelection(textarea, selectionStart + 3, selectionStart + 12);
			} else {
				controls.wrapSelectionInTextareaWith(textarea, '\n* ', '');
				controls.updateTextareaSelection(textarea, selectionStart + 3, selectionEnd + 3);
			}
		},

		'fa fa-link': function(textarea, selectionStart, selectionEnd){
			if(selectionStart === selectionEnd){
				controls.insertIntoTextarea(textarea, "[link text](link url)");

				// Highlight "link url"
				controls.updateTextareaSelection(textarea, selectionStart + 12, selectionEnd + 20);
			} else {
				controls.wrapSelectionInTextareaWith(textarea, '[', '](link url)');

				// Highlight "link url"
				controls.updateTextareaSelection(textarea, selectionEnd + 3, selectionEnd + 11);
			}
		},

		'fa fa-picture-o': function(){
			$('#files').click();
		},

		'fa fa-upload': function(){
			$('#files').click();
		}
	};

	var customButtons = [];

	formatting.addComposerButtons = function() {
		for (var button in customButtons) {
			if (customButtons.hasOwnProperty(button)) {
				$('.formatting-bar .btn-group form').before('<span class="btn btn-link" tabindex="-1"><i class="' + customButtons[button].iconClass + '"></i></span>');
			}
		}
	}

	formatting.addButton = function(iconClass, onClick) {
		formattingDispatchTable[iconClass] = onClick;
		customButtons.push({
			iconClass: iconClass
		});
	}

	formatting.addHandler = function(postContainer) {
		postContainer.on('click', '.formatting-bar span', function () {
			var iconClass = $(this).find('i').attr('class');
			var textarea = $(this).parents('.composer').find('textarea')[0];

			if(formattingDispatchTable.hasOwnProperty(iconClass)){
				formattingDispatchTable[iconClass](textarea, textarea.selectionStart, textarea.selectionEnd);
			}
		});
	};

	return formatting;
});
