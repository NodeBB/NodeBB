"use strict";
/*global app, socket, Mousetrap*/

var admin = {};

(function() {
	admin.enableColorPicker = function(inputEl, callback) {
		(inputEl instanceof jQuery ? inputEl : $(inputEl)).each(function() {
			var $this = $(this);

			$this.ColorPicker({
				color: $this.val() || '#000',
				onChange: function(hsb, hex) {
					$this.val('#' + hex);
					if (typeof callback === 'function') {
						callback(hsb, hex);
					}
				},
				onShow: function(colpkr) {
					$(colpkr).css('z-index', 1051);
				}
			});
		});
	};

	$(function() {
		setupMenu();
		setupKeybindings();
	});

	socket.emit('admin.config.get', function(err, config) {
		if(err) {
			return app.alert({
				alert_id: 'config_status',
				timeout: 2500,
				title: 'Error',
				message: 'NodeBB encountered a problem getting config',
				type: 'danger'
			});
		}

		// move this to admin.config
		app.config = config;
	});

	function setupMenu() {
		var listElements = $('.sidebar-nav li');

		listElements.on('click', function() {
			var $this = $(this);

			if ($this.hasClass('nav-header')) {
				$this.parents('.sidebar-nav').toggleClass('open').bind('animationend webkitAnimationEnd MSAnimationEnd oAnimationEnd', function (ev) {
					$('.nano').nanoScroller();
				});
			} else {
				listElements.removeClass('active');
				$this.addClass('active');
			}
		});

		$('.nano').nanoScroller();

		$('#main-menu .nav-list > li a').append('<span class="pull-right"><i class="fa fa-inverse fa-arrow-circle-right"></i>&nbsp;</span>');
	}

	function setupKeybindings() {
		Mousetrap.bind('ctrl+shift+a r', function() {
			console.log('[admin] Reloading NodeBB...');
			socket.emit('admin.reload');
		});

		Mousetrap.bind('ctrl+shift+a R', function() {
			console.log('[admin] Restarting NodeBB...');
			socket.emit('admin.restart');
		});

		Mousetrap.bind('/', function(e) {
			$('#acp-search input').focus();

			return false;
		});
	}
}());