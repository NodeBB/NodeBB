"use strict";

/*globals define*/

define('admin/selectable', function() {
	var selectable = {};

	selectable.enable = function(parentElement, elementsToSelect) {
		parentElement = $(parentElement);
		elementsToSelect = $(elementsToSelect);

		var offset = parentElement.offset();

		parentElement
			.addClass('selectable')
			.on('click', function(ev) {
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
					left: Math.min(ev.pageX, dd.startX),
					height: Math.abs(ev.pageY - dd.startY),
					width: Math.abs(ev.pageX - dd.startX)
				});
			})
			.drag('end',function(ev, dd){
				$(dd.proxy).remove();
			})
			.css('padding-bottom', '100px');

		elementsToSelect
			.addClass('selection')
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
