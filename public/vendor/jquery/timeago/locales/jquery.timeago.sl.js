// Slovenian with support for dual
(function () {
    var numpf;
    numpf = function (n, a) {
        return a[n%100==1 ? 1 : n%100==2 ? 2 : n%100==3 || n%100==4 ? 3 : 0];
    };

    jQuery.timeago.settings.strings = {
        prefixAgo: null,
        prefixFromNow: "čez",
        suffixAgo: "nazaj",
        suffixFromNow: null,
        second: "sekundo",
        seconds: function (value) {
            return numpf(value, ["%d sekund", "%d sekundo", "%d sekundi", "%d sekunde"]);
        },
        minute: "minuto",
        minutes: function (value) {
            return numpf(value, ["%d minut", "%d minuto", "%d minuti", "%d minute"]);
        },
        hour: "eno uro",
        hours: function (value) {
            return numpf(value, ["%d ur", "%d uro", "%d uri", "%d ure"]);
        },
        day: "en dan",
        days: function (value) {
            return numpf(value, ["%d dni", "%d dan", "%d dneva", "%d dni"]);
        },
        month: "en mesec",
        months: function (value) {
            return numpf(value, ["%d mesecev", "%d mesec", "%d meseca", "%d mesece"]);
        },
        year: "eno leto",
        years: function (value) {
            return numpf(value, ["%d let", "%d leto", "%d leti", "%d leta"]);
        },
        wordSeparator: " "
    };

}).call(this);
