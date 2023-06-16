<div id="skins" class="d-flex flex-column gap-2 px-lg-4">
	<div class="d-flex border-bottom py-2 m-0 sticky-top acp-page-main-header align-items-center justify-content-between flex-wrap gap-2">
		<div class="d-flex flex-wrap gap-3 align-items-center">
			<h4 class="fw-bold tracking-tight mb-0">[[admin/appearance/skins:skins]]</h4>
			<ul class="nav nav-pills d-flex gap-1 text-sm">
				<li class="nav-item"><a href="#" class="nav-link active px-2 py-1" data-bs-target="#skins-tab" data-bs-toggle="tab">[[admin/appearance/skins:bootswatch-skins]]</a></li>
				<li class="nav-item"><a href="#" class="nav-link px-2 py-1" data-bs-target="#custom-skins-tab" data-bs-toggle="tab">[[admin/appearance/skins:custom-skins]]</a></li>
			</ul>
		</div>
		<div class="d-flex align-items-center gap-1">
			<div data-type="bootswatch" data-theme="" data-css="">
				<button data-action="use" class="btn btn-primary btn-sm text-nowrap" type="button">[[admin/appearance/skins:revert-skin]]</button>
			</div>
		</div>
	</div>
	<div class="tab-content">
		<div class="tab-pane fade show active" role="tabpanel" id="skins-tab">
			<div class="skins px-2">
				<div class="directory row text-center" id="bootstrap_themes">
					<i class="fa fa-refresh fa-spin"></i> [[admin/appearance/skins:loading]]
				</div>
			</div>
		</div>
		<div class="tab-pane fade" role="tabpanel" id="custom-skins-tab">
			<form role="form" class="custom-skin-settings">
				<div class="mb-3" data-type="sorted-list" data-sorted-list="custom-skin-list" data-item-template="admin/partials/appearance/skins/item-custom-skin" data-form-template="admin/partials/appearance/skins/form-custom-skin">
					<input hidden="text" name="custom-skin-list">
					<div class="d-flex gap-1 mb-3 justify-content-between">
						<button type="button" data-type="add" class="btn btn-sm btn-light">[[admin/appearance/skins:add-skin]]</button>
						<button id="save-custom-skins" class="btn btn-sm btn-primary">[[admin/appearance/skins:save-custom-skins]]</button>
					</div>

					<ul data-type="list" class="list-group mb-3"></ul>
				</div>
			</form>
		</div>
	</div>
</div>
