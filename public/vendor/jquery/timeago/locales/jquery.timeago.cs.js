// Czech
(function() {
	function f(n, d, a) {
		return a[d>=0 ? 0 : a.length==2 || n<5 ? 1 : 2];
	}

	jQuery.timeago.settings.strings = {
		prefixAgo:     'před',
		prefixFromNow: 'za',
		suffixAgo:     null,
		suffixFromNow: null,
		seconds: function(n, d) {return f(n, d, ['méně než minutou', 'méně než minutu']);},
		minute:  function(n, d) {return f(n, d, ['minutou', 'minutu']);},
		minutes: function(n, d) {return f(n, d, ['%d minutami', '%d minuty', '%d minut']);},
		hour:    function(n, d) {return f(n, d, ['hodinou', 'hodinu']);},
		hours:   function(n, d) {return f(n, d, ['%d hodinami', '%d hodiny', '%d hodin']);},
		day:     function(n, d) {return f(n, d, ['%d dnem', '%d den']);},
		days:    function(n, d) {return f(n, d, ['%d dny', '%d dny', '%d dní']);},
		month:   function(n, d) {return f(n, d, ['%d měsícem', '%d měsíc']);},
		months:  function(n, d) {return f(n, d, ['%d měsíci', '%d měsíce', '%d měsíců']);},
		year:    function(n, d) {return f(n, d, ['%d rokem', '%d rok']);},
		years:   function(n, d) {return f(n, d, ['%d lety', '%d roky', '%d let']);}
	};
})();
