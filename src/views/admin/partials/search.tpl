{{{ if user.privileges.admin:settings }}}
<div component="acp/search" class="my-1 acp-search">
	<div class="dropdown">
		<input type="text" data-bs-toggle="dropdown" class="form-control" placeholder="[[admin/menu:search.placeholder]]" aria-haspopup="true" aria-expanded="false">
		<ul class="dropdown-menu state-start-typing p-1" role="menu">
			<li role="presentation" class="no-results">
				<a class="dropdown-item rounded-1" role="menuitem">[[admin/menu:search.no-results]]</a>
			</li>
			<li role="presentation" class="dropdown-divider search-forum"></li>
			<li role="presentation" class="search-forum">
				<a class="dropdown-item rounded-1" role="menuitem" target="_top" href="#">
					[[admin/menu:search.search-forum]]
				</a>
			</li>
			<li role="presentation" class="keep-typing">
				<a class="dropdown-item rounded-1" role="menuitem">[[admin/menu:search.keep-typing]]</a>
			</li>
			<li role="presentation" class="start-typing">
				<a class="dropdown-item rounded-1" role="menuitem">[[admin/menu:search.start-typing]]</a>
			</li>
		</ul>
	</div>
</div>
{{{ end }}}