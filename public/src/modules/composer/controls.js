"use strict";

/*global define*/

define('composer/controls', function() {
	var controls = {};

	/*************************************************/
	/* Rich Textarea Controls                        */
	/*************************************************/
	controls.insertIntoTextarea = function(textarea, value) {
		var $textarea = $(textarea);
		var currentVal = $textarea.val();

		$textarea.val(
			currentVal.slice(0, textarea.selectionStart) +
			value +
			currentVal.slice(textarea.selectionStart)
		);
	};

	controls.wrapSelectionInTextareaWith = function(textarea, leading, trailing){
		if(trailing === undefined){
			trailing = leading;
		}

		var $textarea = $(textarea);
		var currentVal = $textarea.val();

		$textarea.val(
			currentVal.slice(0, textarea.selectionStart) +
			leading +
			currentVal.slice(textarea.selectionStart, textarea.selectionEnd) +
			trailing +
			currentVal.slice(textarea.selectionEnd)
		);
	};

	controls.updateTextareaSelection = function(textarea, start, end){
		textarea.setSelectionRange(start, end);
		$(textarea).focus();
	};


	return controls;
});