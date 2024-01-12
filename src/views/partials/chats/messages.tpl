{{{each messages}}}
	{{{ if !./system }}}
	<!-- IMPORT partials/chats/message.tpl -->
	{{{ else }}}
	<!-- IMPORT partials/chats/system-message.tpl -->
	{{{ end }}}
{{{end}}}