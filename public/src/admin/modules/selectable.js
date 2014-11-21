"use strict";

/*globals define*/

define('admin/modules/selectable', function() {
	var selectable = {};

	// modified from http://threedubmedia.com/code/event/drop/demo/selection
	selectable.enable = function(parentElement, elementsToSelect, events) {
		function selected(element) {
			var $element = $(element).toggleClass('selected');

			if (events && typeof events.onSelected === 'function') {
				events.onSelected($element);
			}
		}

		function unselected(element) {
			var $element = $(element).removeClass('selected');

			if (events && typeof events.onUnselected === 'function') {
				events.onUnselected($element);
			}
		}

		parentElement = $(parentElement);
		elementsToSelect = $(elementsToSelect).not('.selection');

		var offset = parentElement.offset();

		parentElement
			.addClass('selectable')
			.on('mousedown', function(ev) {
				if (!ev.shiftKey) {
					unselected(elementsToSelect);
				}
			})
			.drag('start',function(ev, dd) {
				if (!ev.shiftKey) {
					unselected(elementsToSelect);
				}

				return $('<div class="selector" />')
					.css('opacity', 0.65 )
					.appendTo(parentElement);
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
			});

		elementsToSelect
			.addClass('selection')
			.on('mouseup', function(ev) {
				selected(this);
			})
			.drop('start',function(){
				$(this).addClass('active');
			})
			.drop(function( ev, dd ){
				selected(this);
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
