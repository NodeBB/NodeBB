<div class="row">
	<div class="col-12">
		<form role="form" class="category">
			<div class="">
				<p>
					[[admin/manage/categories:privileges.description]]
				</p>

				<div class="lead mb-3">
					[[admin/manage/categories:privileges.category-selector]]
					<!-- IMPORT partials/category-selector.tpl -->
				</div>

				<div class="privilege-table-container">
					{{{ if cid }}}
					<!-- IMPORT admin/partials/privileges/category.tpl -->
					{{{ else }}}
					<!-- IMPORT admin/partials/privileges/global.tpl -->
					{{{ end }}}
				</div>
			</div>
		</form>
	</div>
</div>

<div class="floating-button">
	<button id="discard" class="btn btn-primary position-fixed bottom-0 end-0 px-3 py-2 mb-4 me-4 rounded-circle" type="button">
		<i class="fa fa-rotate-left"></i>
	</button>

	<!-- IMPORT admin/partials/save_button.tpl -->
</div>