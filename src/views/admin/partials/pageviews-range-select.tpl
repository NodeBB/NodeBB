<form role="form">
	<fieldset>
		<div class="alert alert-danger hidden">{{tx("admin/dashboard:page-views-custom-error")}}</div>
		<div class="row">
			<div class="col-6">
				<div class="mb-3">
					<label class="form-label" for="startRange">{{tx("admin/dashboard:page-views-custom-start")}}</label>
					<input class="form-control" type="date" id="startRange" name="startRange" />
				</div>
			</div>
			<div class="col-6">
				<div class="mb-3">
					<label class="form-label" for="endRange">{{tx("admin/dashboard:page-views-custom-end")}}</label>
					<input class="form-control" type="date" id="endRange" name="endRange" />
				</div>
			</div>
		</div>
		<p class="form-text">{{tx("admin/dashboard:page-views-custom-help")}}</p>
	</fieldset>
</form>