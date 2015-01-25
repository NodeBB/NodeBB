'use strict';

/* globals define */

define('composer/formatting', ['composer/controls', 'composer/preview'], function(controls, preview) {

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
		},

		'fa fa-tags': function() {
			$('.tags-container').toggleClass('hidden');
		}
	};

	var customButtons = [];

	formatting.addComposerButtons = function() {
		var $toolbar = $('.formatting-bar .btn-group');
		customButtons.forEach(function (button) {
			var $btn = $('<span class="btn btn-link" tabindex="-1"><i class="' + button.icon + '"></i></span>');

			if (button.id) {
				$btn.attr('data-btn-id', button.id);
			}

			if (button.title) {
				if (button.title.match(/\[\[.*?\]\]/)) {
					//Translate the button title
					translator.translate(button.title, function (translated) {
						$btn.attr('data-original-title', translated);
						$btn.tooltip({placement: 'bottom', container: '.formatting-bar'});
					});
				} else {
					$btn.attr('data-original-title', button.title);
				}
			}

			var sibling;
			if (button.after && (sibling = getButton(button.after)).length) {
				//Add just after this button
				sibling.after($btn);
			} else if (button.before && (sibling = getButton(button.before)).length) {
				//Add just before this button
				sibling.before($btn);
			} else {
				//Add at the end of the toolbar (just before the help button, or file upload form if there isn't a help button)
				$toolbar.find('.help, form').first().before($btn);
			}
		});
		
		$toolbar.find('[data-original-title]').tooltip({placement: 'bottom', container: '.formatting-bar'});
	};
	
	function getButton(id) {
		var $toolbar = $('.formatting-bar .btn-group');
		var btn = $toolbar.find('[data-btn-id=' + id + ']');
		if (!btn.length) {
			//Backward compatibility
			btn = $toolbar.find('i.fa-' + id).parent();
		}
		return btn;
	}

	formatting.addButton = function(button) {
		formattingDispatchTable[button.id] = button.handler;
		customButtons.push(button);
	};

	formatting.addHandler = function(postContainer) {
		postContainer.on('click', '.formatting-bar span', function () {
			var id = $(this).data('btn-id') || $(this).find('i').attr('class');
			var textarea = $(this).parents('.composer').find('textarea')[0];

			formattingDispatchTable[id](textarea, textarea.selectionStart, textarea.selectionEnd);
			preview.render(postContainer);
		});
	};

	return formatting;
});
