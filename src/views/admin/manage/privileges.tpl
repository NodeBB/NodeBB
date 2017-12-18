<div class="row">
	<form role="form" class="category">
		<div class="row">
			<div class="col-md-3 pull-right">
				<select id="category-selector" class="form-control">
					<option value="global" selected>[[admin/manage/privileges:global]]</option>
					<option disabled>_____________</option>
					<!-- BEGIN allCategories -->
					<option value="{allCategories.value}">{allCategories.text}</option>
					<!-- END allCategories -->
				</select>
			</div>
		</div>

		<br/>

		<div class="">
			<p>
				[[admin/manage/privileges:global.description]]
			</p>
			<p class="text-warning">
				[[admin/manage/privileges:global.warning]]
			</p>
			<hr />
			<div class="privilege-table-container">
				<!-- IMPORT admin/partials/global/privileges.tpl -->
			</div>
		</div>
	</form>
</div>

<button id="save" class="floating-button mdl-button mdl-js-button mdl-button--fab mdl-js-ripple-effect mdl-button--colored">
    <i class="material-icons">save</i>
</button>
