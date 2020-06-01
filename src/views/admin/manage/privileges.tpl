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
				{{{ if type.global }}}
				<!-- IMPORT admin/partials/privileges/global.tpl -->
				{{{ end }}}
				{{{ if type.admin }}}
				<!-- IMPORT admin/partials/privileges/admin.tpl -->
				{{{ end }}}
				{{{ if type.cid }}}
				<!-- IMPORT admin/partials/privileges/category.tpl -->
				{{{ end }}}
			</div>
		</div>
	</form>
</div>
