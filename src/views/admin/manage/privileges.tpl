<div class="row">
	<form role="form" class="category">
		<div class="">
			<p>
				[[admin/manage/categories:privileges.description]]
			</p>

			<div class="lead">
				[[admin/manage/categories:privileges.category-selector]]
				<!-- IMPORT partials/category-selector.tpl -->
			</div>

			<div class="privilege-table-container">
				{{{ if cid }}}
				<!-- IMPORT admin/partials/privileges/category.tpl -->
				{{{ else }}}
				<!-- IMPORT admin/partials/privileges/global.tpl -->
				{{{ endif }}}
			</div>
		</div>
	</form>
</div>
