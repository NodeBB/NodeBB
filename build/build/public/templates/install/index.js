
(function (factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else if (typeof define === 'function' && define.amd) {
    define(factory);
  }
})(function () {
  function compiled(helpers, context, guard, iter, helper) {
    var __escape = helpers.__escape;
    var value = context;
    return "<!DOCTYPE html>\n<html>\n<head>\n\t<meta charset=\"utf-8\">\n\t<meta http-equiv=\"X-UA-Compatible\" content=\"IE=edge\">\n\t<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n\t<title>NodeBB Web Installer</title>\n\n\t<link rel=\"stylesheet\" type=\"text/css\" href=\"bootstrap.min.css\">\n\t<link rel=\"stylesheet\" type=\"text/css\" href=\"installer.css\">\n\n\t<script type=\"text/javascript\" async defer src=\"/assets/installer.min.js\"></script>\n</head>\n\n<body>\n\t<nav class=\"navbar navbar-expand-lg bg-light\">\n\t\t<div class=\"container-fluid\">\n\t\t\t<a class=\"navbar-brand\" href=\"#\">NodeBB</a>\n\t\t\t<button class=\"navbar-toggler\" type=\"button\" data-bs-toggle=\"collapse\" data-bs-target=\"#navbar-menu\" aria-controls=\"navbar-menu\" aria-expanded=\"false\" aria-label=\"Toggle navigation\">\n\t\t\t\t<span class=\"navbar-toggler-icon\"></span>\n\t\t\t</button>\n\t\t\t<div class=\"collapse navbar-collapse\" id=\"navbar-menu\">\n\t\t\t\t<ul class=\"navbar-nav me-auto mb-2 mb-lg-0\">\n\t\t\t\t\t<li class=\"nav-item\"><a class=\"nav-link active\" href=\"/\">Installer</a></li>\n\t\t\t\t\t<li class=\"nav-item\"><a class=\"nav-link\" href=\"https://docs.nodebb.org\" target=\"_blank\">Get Help</a></li>\n\t\t\t\t\t<li class=\"nav-item\"><a class=\"nav-link\" href=\"https://community.nodebb.org\" target=\"_blank\">Community</a></li>\n\t\t\t\t</ul>\n\t\t\t</div>\n\t\t</div>\n\t</nav>\n\t" + 
      (guard((context != null) ? context['installing'] : null) ?
        "" :
        "\n\t<div class=\"container " + 
          (guard((context != null) ? context['success'] : null) ?
            "hide" :
            "") + 
          "\">\n\t\t<p>\n\t\t\t<h1>Welcome to the NodeBB Installer</h1>\n\t\t\tYou are just a few steps away from launching your own NodeBB forum!\n\t\t</p>\n\t\t<form id=\"install\" action=\"/\" method=\"post\" autocomplete=\"off\">\n\t\t\t" + 
          (guard((context != null) ? context['skipGeneralSetup'] : null) ?
            "" :
            "\n\t\t\t<div class=\"general\">\n\t\t\t\t<p>\n\t\t\t\t\t<h2><small>General Instance Setup</small></h2>\n\t\t\t\t\t<hr />\n\t\t\t\t</p>\n\n\t\t\t\t<div class=\"row input-row\">\n\t\t\t\t\t<div class=\"col-sm-7 col-12 input-field\">\n\t\t\t\t\t\t<label class=\"form-label\" for=\"install:url\">Web Address (URL)</label>\n\t\t\t\t\t\t<input id=\"install:url\" type=\"text\" class=\"form-control\" name=\"url\" value=\"" + 
              (guard((context != null) ? context['url'] : null) ?
                __escape(guard((context != null) ? context['url'] : null)) :
                "") + 
              "\" placeholder=\"http://localhost:4567\" />\n\t\t\t\t\t</div>\n\t\t\t\t\t<div class=\"col-sm-5 form-text\" data-help=\"This is the address that resolves to your NodeBB forum. If no port is specified, <code>4567</code> will be used.\"></div>\n\t\t\t\t</div>\n\t\t\t</div>\n\t\t\t") + 
          "\n\t\t\t<div class=\"admin\">\n\t\t\t\t<p>\n\t\t\t\t\t<h2><small>Create an Administrator account</small></h2>\n\t\t\t\t\t<hr />\n\t\t\t\t</p>\n\n\t\t\t\t<div class=\"row input-row\">\n\t\t\t\t\t<div class=\"col-sm-7 col-12 input-field\">\n\t\t\t\t\t\t<label class=\"form-label\" for=\"admin:username\">Username</label>\n\t\t\t\t\t\t<input id=\"admin:username\" type=\"text\" class=\"form-control\" name=\"admin:username\" value=\"admin\" placeholder=\"Username\" autocomplete=\"off\"/>\n\t\t\t\t\t</div>\n\t\t\t\t\t<div class=\"col-sm-5 form-text\" data-help=\"Enter an <strong>alphanumeric username</strong>. Spaces between words are allowed. You can always change your username later on your profile page.\"></div>\n\t\t\t\t</div>\n\t\t\t\t<div class=\"row input-row\">\n\t\t\t\t\t<div class=\"col-sm-7 col-12 input-field\">\n\t\t\t\t\t\t<label class=\"form-label\" for=\"admin:email\">Email Address</label>\n\t\t\t\t\t\t<input id=\"admin:email\" type=\"text\" class=\"form-control\" name=\"admin:email\" value=\"bhavyadhiman7@gmail.com\" placeholder=\"Email Address\" autocomplete=\"off\" />\n\t\t\t\t\t</div>\n\t\t\t\t\t<div class=\"col-sm-5 form-text\" data-help=\"Please enter your email address.\"></div>\n\t\t\t\t</div>\n\t\t\t\t<div class=\"row input-row\">\n\t\t\t\t\t<div class=\"col-sm-7 col-12 input-field\">\n\t\t\t\t\t\t<label class=\"form-label\" for=\"admin:password\">Password</label>\n\t\t\t\t\t\t<input id=\"admin:password\" type=\"password\" class=\"form-control\" name=\"admin:password\" value=\"adminnodebb\" placeholder=\"Password\" data-minimum-strength=\"" + 
          __escape(guard((context != null) ? context['minimumPasswordStrength'] : null)) + 
          "\" data-minimum-length=\"" + 
          __escape(guard((context != null) ? context['minimumPasswordLength'] : null)) + 
          "\" autocomplete=\"off\"/>\n\t\t\t\t\t</div>\n\t\t\t\t\t<div class=\"col-sm-5 form-text\" data-help=\"Use a combination of numbers, symbols, and different cases. You can change the strictness of password creation in the Admin Control Panel. Minimum " + 
          __escape(guard((context != null) ? context['minimumPasswordLength'] : null)) + 
          " characters.\"></div>\n\t\t\t\t</div>\n\t\t\t\t<div class=\"row input-row\">\n\t\t\t\t\t<div class=\"col-sm-7 col-12 input-field\">\n\t\t\t\t\t\t<label class=\"form-label\" for=\"admin:passwordConfirm\">Confirm Password</label>\n\t\t\t\t\t\t<input id=\"admin:passwordConfirm\" type=\"password\" class=\"form-control\" name=\"admin:passwordConfirm\" value=\"adminnodebb\" placeholder=\"Confirm Password\" autocomplete=\"off\"/>\n\t\t\t\t\t</div>\n\t\t\t\t\t<div class=\"col-sm-5 form-text\" data-help=\"Please confirm your password.\"></div>\n\t\t\t\t</div>\n\t\t\t</div>\n\n\t\t\t" + 
          (guard((context != null) ? context['error'] : null) ?
            "\n\t\t\t<a id=\"database-error\"></a>\n\t\t\t" :
            "") + 
          "\n\n\t\t\t" + 
          (guard((context != null) ? context['skipDatabaseSetup'] : null) ?
            "" :
            "\n\t\t\t<div class=\"database\">\n\t\t\t\t<p>\n\t\t\t\t\t<h2><small>Configure your database</small></h2>\n\t\t\t\t\t<hr />\n\t\t\t\t</p>\n\n\t\t\t\t<div class=\"row input-row\">\n\t\t\t\t\t<div class=\"col-sm-7 col-12 input-field\">\n\t\t\t\t\t\t<label class=\"form-label\" for=\"install:database\">Database Type</label>\n\t\t\t\t\t\t<select id=\"install:database\" class=\"form-select\" name=\"database\">\n\t\t\t\t\t\t\t<option value=\"mongo\">MongoDB</option>\n\t\t\t\t\t\t\t<option value=\"redis\">Redis</option>\n\t\t\t\t\t\t\t<option value=\"postgres\">PostgreSQL</option>\n\t\t\t\t\t\t</select>\n\t\t\t\t\t</div>\n\t\t\t\t\t<div class=\"col-sm-5 form-text\" data-help=\"Leave the fields blank to use the default settings.\">" + 
              (guard((context != null) ? context['error'] : null) ?
                "There was an error connecting to your database. Please try again." :
                "") + 
              "</div>\n\t\t\t\t</div>\n\n\t\t\t\t<div id=\"database-config\"></div>\n\t\t\t</div>\n\t\t\t") + 
          "\n\n\t\t\t<button id=\"submit\" type=\"submit\" class=\"btn btn btn-success\">Install NodeBB <i class=\"working hide\"></i></button>\n\t\t</form>\n\t</div>\n\t") + 
      "\n\n\t" + 
      (guard((context != null) ? context['installing'] : null) ?
        "\n\t<div id=\"installing\" class=\"container\">\n\t\t<p>\n\t\t\t<h1>Hang tight! Your NodeBB is being installed.</h1>\n\t\t</p>\n\t</div>\n\t" :
        "") + 
      "\n\n\t<div class=\"container " + 
      (guard((context != null) ? context['success'] : null) ?
        "" :
        "hide") + 
      "\">\n\t\t<p>\n\t\t\t<h1>Congratulations! Your NodeBB has been set-up.</h1>\n\n\t\t\t<button id=\"launch\" data-url=\"" + 
      __escape(guard((context != null) ? context['launchUrl'] : null)) + 
      "\" class=\"btn btn btn-success\">Launch NodeBB <i class=\"working hide\"></i></button>\n\t\t</p>\n\t</div>\n\n\t<div class=\"hide\">\n\t\t" + 
      compiled.blocks['databases'](helpers, context, guard, iter, helper) + 
      "\n\t</div>\n</body>\n</html>";
  }

  compiled.blocks = {
    'databases': function databases(helpers, context, guard, iter, helper) {
      var __escape = helpers.__escape;
      var value = context;
      return iter(guard((context != null) ? context['databases'] : null), function each(key0, index, length, value) {
        var key = key0;
        return "\n\t\t<div data-database=\"" + 
          __escape(guard((context != null && context['databases'] != null && context['databases'][key0] != null) ? context['databases'][key0]['name'] : null)) + 
          "\">\n\t\t\t " + 
          iter(guard((context != null && context['databases'] != null && context['databases'][key0] != null) ? context['databases'][key0]['questions'] : null), function each(key1, index, length, value) {
            var key = key1;
            return "\n\t\t\t\t<div class=\"row input-row\">\n\t\t\t\t\t<div class=\"col-sm-7 col-12 input-field\">\n\t\t\t\t\t\t<label class=\"form-label\" for=\"" + 
              __escape(guard((context != null && context['databases'] != null && context['databases'][key0] != null && context['databases'][key0]['questions'] != null && context['databases'][key0]['questions'][key1] != null) ? context['databases'][key0]['questions'][key1]['name'] : null)) + 
              "\">" + 
              __escape(guard((context != null && context['databases'] != null && context['databases'][key0] != null && context['databases'][key0]['questions'] != null && context['databases'][key0]['questions'][key1] != null) ? context['databases'][key0]['questions'][key1]['description'] : null)) + 
              "</label>\n\t\t\t\t\t\t<input id=\"" + 
              __escape(guard((context != null && context['databases'] != null && context['databases'][key0] != null && context['databases'][key0]['questions'] != null && context['databases'][key0]['questions'][key1] != null) ? context['databases'][key0]['questions'][key1]['name'] : null)) + 
              "\" type=\"" + 
              (guard((context != null) ? context['hidden'] : null) ?
                "password" :
                "text") + 
              "\" class=\"form-control\" name=\"" + 
              __escape(guard((context != null && context['databases'] != null && context['databases'][key0] != null && context['databases'][key0]['questions'] != null && context['databases'][key0]['questions'][key1] != null) ? context['databases'][key0]['questions'][key1]['name'] : null)) + 
              "\" placeholder=\"" + 
              __escape(guard((context != null && context['databases'] != null && context['databases'][key0] != null && context['databases'][key0]['questions'] != null && context['databases'][key0]['questions'][key1] != null) ? context['databases'][key0]['questions'][key1]['default'] : null)) + 
              "\" value=\"" + 
              __escape(guard((context != null && context['databases'] != null && context['databases'][key0] != null && context['databases'][key0]['questions'] != null && context['databases'][key0]['questions'][key1] != null) ? context['databases'][key0]['questions'][key1]['default'] : null)) + 
              "\" />\n\t\t\t\t\t</div>\n\t\t\t\t</div>\n\t\t\t";
          }, function alt() {
            return "";
          }) + 
          "\n\t\t</div>\n\t\t";
      }, function alt() {
        return "";
      });
    }
  };

  return compiled;
})
