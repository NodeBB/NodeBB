<!-- IMPORT partials/breadcrumbs.tpl -->
<div class="users flex-fill">
	<div id="users-container" class="users-container row row-cols-2 row-cols-md-3 row-cols-lg-4 row-cols-xl-5 g-4">
		{{{ each users }}}
		<!-- IMPORT partials/users/item.tpl -->
		{{{ end }}}
	</div>

	<!-- IMPORT partials/paginator.tpl -->
</div>