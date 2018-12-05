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

			<hr />

			<div class="privilege-table-container">
				<!-- IF cid -->
				<!-- IMPORT admin/partials/categories/privileges.tpl -->
				<!-- ELSE -->
				<!-- IMPORT admin/partials/global/privileges.tpl -->
				<!-- ENDIF cid -->
			</div>
		</div>
	</form>
</div>
