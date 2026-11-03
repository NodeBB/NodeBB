<div class="icon-container">
	<div class="form-group">
		<label class="form-label" for="fa-filter">{{tx("fontawesome:search-placeholder")}}</label>
		<input type="text" class="form-control" id="fa-filter" data-action="filter" placeholder="e.g. umbrella" />
	</div>
	<div class="d-flex nbb-fa-icons flex-wrap">
		{{{ each icons }}}
			<i class="fa fa-xl fa-{icons.style} fa-{icons.id} rounded-1"></i>
		{{{ end }}}
	</div>
	<p class="form-text text-center">
		{{tx("fontawesome:full-list")}}
		<a href="https://fontawesome.com/icons">{{tx("fontawesome:fontawesome")}}</a>
	</p>
</div>