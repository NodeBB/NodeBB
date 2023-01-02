/*
 *  Bootstrap Auto-Hiding Navbar - v4.0.0
 *  An extension for Bootstrap's fixed navbar which hides the navbar while the page is scrolling downwards and shows it the other way. The plugin is able to show/hide the navbar programmatically as well.
 *  http://www.virtuosoft.eu/code/bootstrap-autohidingnavbar/
 *
 *  Made by István Ujj-Mészáros
 *  Under Apache License v2.0 License
 */
;(function($, window, document, undefined) {
    var pluginName = 'autoHidingNavbar',
        $window = $(window),
        $document = $(document),
        _scrollThrottleTimer = null,
        _resizeThrottleTimer = null,
        _throttleDelay = 70,
        _lastScrollHandlerRun = 0,
        _previousScrollTop = null,
        _windowHeight = $window.height(),
        _visible = true,
        _hideOffset,
        defaults = {
          disableAutohide: false,
          showOnUpscroll: true,
          showOnBottom: true,
          hideOffset: 'auto', // "auto" means the navbar height
          animationDuration: 200,
          navbarOffset: 0
        };

    function AutoHidingNavbar(element, options) {
      this.element = $(element);
      this.settings = $.extend({}, defaults, options);
      this._defaults = defaults;
      this._name = pluginName;
      this.init();
    }

    function hide(autoHidingNavbar) {
      if (!_visible) {
        return;
      }

      autoHidingNavbar.element.addClass('navbar-hidden').animate({
        top: -1 * parseInt(autoHidingNavbar.element.css('height'), 10) + autoHidingNavbar.settings.navbarOffset
      }, {
        queue: false,
        duration: autoHidingNavbar.settings.animationDuration
      });

      try {
        $('.dropdown.open .dropdown-toggle, .dropdown.show .dropdown-toggle', autoHidingNavbar.element).dropdown('toggle');
      }
      catch(e) {}

      _visible = false;

      autoHidingNavbar.element.trigger('hide.autoHidingNavbar');
    }

    function show(autoHidingNavbar) {
      if (_visible) {
        return;
      }

      autoHidingNavbar.element.removeClass('navbar-hidden').animate({
        top: 0
      }, {
        queue: false,
        duration: autoHidingNavbar.settings.animationDuration
      });
      _visible = true;

      autoHidingNavbar.element.trigger('show.autoHidingNavbar');
    }

    function detectState(autoHidingNavbar) {
      var scrollTop = $window.scrollTop(),
          scrollDelta = scrollTop - _previousScrollTop;

      _previousScrollTop = scrollTop;

      if (scrollDelta < 0) {
        if (_visible) {
          return;
        }

        if (autoHidingNavbar.settings.showOnUpscroll || scrollTop <= _hideOffset) {
          show(autoHidingNavbar);
        }
      }
      else if (scrollDelta > 0) {
        if (!_visible) {
          if (autoHidingNavbar.settings.showOnBottom && scrollTop + _windowHeight === $document.height()) {
            show(autoHidingNavbar);
          }
          return;
        }

        if (scrollTop >= _hideOffset) {
          hide(autoHidingNavbar);
        }
      }

    }

    function scrollHandler(autoHidingNavbar) {
      if (autoHidingNavbar.settings.disableAutohide) {
        return;
      }

      _lastScrollHandlerRun = new Date().getTime();

      detectState(autoHidingNavbar);
    }

    function bindEvents(autoHidingNavbar) {
      $document.on('scroll.' + pluginName, function() {
        if (new Date().getTime() - _lastScrollHandlerRun > _throttleDelay) {
          scrollHandler(autoHidingNavbar);
        }
        else {
          clearTimeout(_scrollThrottleTimer);
          _scrollThrottleTimer = setTimeout(function() {
            scrollHandler(autoHidingNavbar);
          }, _throttleDelay);
        }
      });

      $window.on('resize.' + pluginName, function() {
        clearTimeout(_resizeThrottleTimer);
        _resizeThrottleTimer = setTimeout(function() {
          _windowHeight = $window.height();
        }, _throttleDelay);
      });
    }

    function unbindEvents() {
      $document.off('.' + pluginName);

      $window.off('.' + pluginName);
    }

    AutoHidingNavbar.prototype = {
      init: function() {
        this.elements = {
          navbar: this.element
        };

        this.setDisableAutohide(this.settings.disableAutohide);
        this.setShowOnUpscroll(this.settings.showOnUpscroll);
        this.setShowOnBottom(this.settings.showOnBottom);
        this.setHideOffset(this.settings.hideOffset);
        this.setAnimationDuration(this.settings.animationDuration);

        _hideOffset = this.settings.hideOffset === 'auto' ? parseInt(this.element.css('height'), 10) : this.settings.hideOffset;
        bindEvents(this);

        return this.element;
      },
      setDisableAutohide: function(value) {
        this.settings.disableAutohide = value;
        return this.element;
      },
      setShowOnUpscroll: function(value) {
        this.settings.showOnUpscroll = value;
        return this.element;
      },
      setShowOnBottom: function(value) {
        this.settings.showOnBottom = value;
        return this.element;
      },
      setHideOffset: function(value) {
        this.settings.hideOffset = value;
        return this.element;
      },
      setAnimationDuration: function(value) {
        this.settings.animationDuration = value;
        return this.element;
      },
      show: function() {
        show(this);
        return this.element;
      },
      hide: function() {
        hide(this);
        return this.element;
      },
      destroy: function() {
        unbindEvents(this);
        show(this);
        $.data(this, 'plugin_' + pluginName, null);
        return this.element;
      }
    };

    $.fn[pluginName] = function(options) {
      var args = arguments;

      if (options === undefined || typeof options === 'object') {
        return this.each(function() {
          if (!$.data(this, 'plugin_' + pluginName)) {
            $.data(this, 'plugin_' + pluginName, new AutoHidingNavbar(this, options));
          }
        });
      } else if (typeof options === 'string' && options[0] !== '_' && options !== 'init') {
        var returns;

        this.each(function() {
          var instance = $.data(this, 'plugin_' + pluginName);

          if (instance instanceof AutoHidingNavbar && typeof instance[options] === 'function') {
            returns = instance[options].apply(instance, Array.prototype.slice.call(args, 1));
          }
        });

        return returns !== undefined ? returns : this;
      }

    };

  })(jQuery, window, document);