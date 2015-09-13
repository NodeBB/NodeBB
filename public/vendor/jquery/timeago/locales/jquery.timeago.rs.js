// Serbian
(function () {
    var numpf;

    numpf = function (n, f, s, t) {
        var n10;
        n10 = n % 10;
        if (n10 === 1 && (n === 1 || n > 20)) {
            return f;
        } else if (n10 > 1 && n10 < 5 && (n > 20 || n < 10)) {
            return s;
        } else {
            return t;
        }
    };

    jQuery.timeago.settings.strings = {
        prefixAgo: "pre",
        prefixFromNow: "za",
        suffixAgo: null,
        suffixFromNow: null,
        second: "sekund",
        seconds: function (value) {
            return numpf(value, "%d sekund", "%d sekunde", "%d sekundi");
        },
        minute: "oko minut",
        minutes: function (value) {
            return numpf(value, "%d minut", "%d minuta", "%d minuta");
        },
        hour: "oko jedan sat",
        hours: function (value) {
            return numpf(value, "%d sat", "%d sata", "%d sati");
        },
        day: "jedan dan",
        days: function (value) {
            return numpf(value, "%d dan", "%d dana", "%d dana");
        },
        month: "mesec dana",
        months: function (value) {
            return numpf(value, "%d mesec", "%d meseca", "%d meseci");
        },
        year: "godinu dana",
        years: function (value) {
            return numpf(value, "%d godinu", "%d godine", "%d godina");
        },
        wordSeparator: " "
    };

}).call(this);
