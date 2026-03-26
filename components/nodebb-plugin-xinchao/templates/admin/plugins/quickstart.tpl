<div class="acp-page-container">
	<!-- IMPORT admin/partials/settings/header.tpl -->

	<div class="row m-0">
		<div id="spy-container" class="col-12 col-md-8 px-0 mb-4" tabindex="0">
			<form role="form" class="quickstart-settings">
				<div class="mb-4">
					<h5 class="fw-bold tracking-tight settings-header">General</h5>

					<p class="lead">
						Adjust these settings. You can then retrieve these settings in code via:
						<br/><code>await meta.settings.get('quickstart');</code>
					</p>
					<div class="mb-3">
						<label class="form-label" for="setting-1">Setting 1</label>
						<input type="text" id="setting-1" name="setting-1" title="Setting 1" class="form-control" placeholder="Setting 1">
					</div>
					<div class="mb-3">
						<label class="form-label" for="setting-2">Setting 2</label>
						<input type="text" id="setting-2" name="setting-2" title="Setting 2" class="form-control" placeholder="Setting 2">
					</div>

					<div class="form-check form-switch">
						<input type="checkbox" class="form-check-input" id="setting-3" name="setting-3">
						<label for="setting-3" class="form-check-label">Setting 3</label>
					</div>
				</div>

				<div class="mb-4">
					<h5 class="fw-bold tracking-tight settings-header">Colors</h5>

					<p class="alert" id="preview">
						Here is some preview text. Use the inputs below to modify this alert's appearance.
					</p>
					<div class="mb-3 d-flex gap-2">
						<label class="form-label" for="color">Foreground</label>
						<input data-settings="colorpicker" type="color" id="color" name="color" title="Background Color" class="form-control p-1" placeholder="#ffffff" value="#ffffff" style="width: 64px;"/>
					</div>
					<div class="mb-3 d-flex gap-2">
						<label class="form-label" for="bgColor">Background</label>
						<input data-settings="colorpicker" type="color" id="bgColor" name="bgColor" title="Background Color" class="form-control p-1" placeholder="#000000" value="#000000" style="width: 64px;" />
					</div>
				</div>

				<div class="mb-4">
					<h5 class="fw-bold tracking-tight settings-header">Sorted List</h5>

					<div class="mb-3" data-type="sorted-list" data-sorted-list="sample-list" data-item-template="admin/plugins/quickstart/partials/sorted-list/item" data-form-template="admin/plugins/quickstart/partials/sorted-list/form">
						<ul data-type="list" class="list-group mb-2"></ul>
						<button type="button" data-type="add" class="btn btn-info">Add Item</button>
					</div>
				</div>

				<div>
					<h5 class="fw-bold tracking-tight settings-header">Uploads</h5>

					<label class="form-label" for="uploadedImage">Upload Image</label>
					<div class="d-flex gap-1">
						<input id="uploadedImage" name="uploadedImage" type="text" class="form-control" />
						<input value="Upload" data-action="upload" data-target="uploadedImage" type="button" class="btn btn-light" />
					</div>
				</div>
			</form>
		</div>

		<!-- IMPORT admin/partials/settings/toc.tpl -->
	</div>
</div>