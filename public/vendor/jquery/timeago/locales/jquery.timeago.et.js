// Estonian
jQuery.timeago.settings.strings = {
  prefixAgo: null,
  prefixFromNow: null,
  suffixAgo: "tagasi",
  suffixFromNow: "pärast",
  seconds: function(n, d) { return d < 0 ? "vähem kui minuti aja" : "vähem kui minut aega"; },
  minute: function(n, d) { return d < 0 ? "umbes minuti aja" : "umbes minut aega"; },
  minutes: function(n, d) { return d < 0 ? "%d minuti" : "%d minutit"; },
  hour: function(n, d) { return d < 0 ? "umbes tunni aja" : "umbes tund aega"; },
  hours: function(n, d) { return d < 0 ? "%d tunni" : "%d tundi"; },
  day: function(n, d) { return d < 0 ? "umbes päeva" : "umbes päev"; },
  days: function(n, d) { return d < 0 ? "%d päeva" : "%d päeva"; },
  month: function(n, d) { return d < 0 ? "umbes kuu aja" : "umbes kuu aega"; },
  months: function(n, d) { return d < 0 ? "%d kuu" : "%d kuud"; },
  year: function(n, d) { return d < 0 ? "umbes aasta aja" : "umbes aasta aega"; },
  years: function(n, d) { return d < 0 ? "%d aasta" : "%d aastat"; }
};
