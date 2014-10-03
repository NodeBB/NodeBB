"use strict";

/*globals define*/

define('admin/selectable', function() {
	var selectable = {};

	// modified from http://threedubmedia.com/code/event/drop/demo/selection
	selectable.enable = function(parentElement, elementsToSelect) {
		parentElement = $(parentElement);
		elementsToSelect = $(elementsToSelect);

		var offset = parentElement.offset();

		parentElement
			.addClass('selectable')
			.on('mousedown', function(ev) {
				if (!ev.shiftKey) {
					elementsToSelect.removeClass('dropped');
				}
			})
			.drag('start',function(ev, dd) {
				if (!ev.shiftKey) {
					elementsToSelect.removeClass('dropped');
				}

				return $('<div class="selector" />')
					.css('opacity', 0.65 )
					.appendTo('.tag-list');
			})
			.drag(function(ev, dd){
				$(dd.proxy).css({
					top: Math.min(ev.pageY - offset.top, dd.startY - offset.top),
					left: Math.min(ev.pageX  - offset.left, dd.startX - offset.left),
					height: Math.abs(ev.pageY - dd.startY),
					width: Math.abs(ev.pageX - dd.startX)
				});
			})
			.drag('end',function(ev, dd){
				$(dd.proxy).remove();
			})

		elementsToSelect
			.addClass('selection')
			.on('mouseup', function(ev) {
				$(this).addClass('dropped');
			})
			.drop('start',function(){
				$(this).addClass('active');
			})
			.drop(function( ev, dd ){
				$(this).addClass('dropped');
			})
			.drop('end',function(){
				$(this).removeClass('active');
			});

		$.drop({
			multi: true
		});
	};

	return selectable;
});
