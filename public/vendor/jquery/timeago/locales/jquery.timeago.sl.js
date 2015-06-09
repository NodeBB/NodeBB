// Slovenian with support for dual
(function () {
    var numpf;
    numpf = function (n, d, m) {
        if (n == 2) {
            return d;
        } else {
            return m;
        }
    };

    jQuery.timeago.settings.strings = {
        prefixAgo: "pred",
        prefixFromNow: "čez",
        suffixAgo: null,
        suffixFromNow: null,
        second: "sekundo",
        seconds: function (value) {
            return numpf(value, "%d sekundama", "%d sekundami");
        },
        minute: "minuto",
        minutes: function (value) {
            return numpf(value, "%d minutama", "%d minutami");
        },
        hour: "uro",
        hours: function (value) {
            return numpf(value, "%d urama", "%d urami");
        },
        day: "dnevom",
        days: function (value) {
            return numpf(value, "%d dnevi", "%d dnevi");
        },
        month: "enim mescem",
        months: function (value) {
            return numpf(value, "%d mesecema", "%d meseci");
        },
        year: "enim letom",
        years: function (value) {
            return numpf(value, "%d letoma", "%d leti");
        },
        wordSeparator: " "
    };

}).call(this);
