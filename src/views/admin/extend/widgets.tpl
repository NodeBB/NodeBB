<div class="tags d-flex flex-column gap-2 px-lg-4">
	<div class="d-flex border-bottom py-2 m-0 sticky-top acp-page-main-header align-items-center justify-content-between flex-wrap gap-2">
		<div class="">
			<h4 class="fw-bold tracking-tight mb-0">[[admin/extend/widgets:widgets]]</h4>
		</div>
		<div class="d-flex align-items-center gap-1">
			<button id="save" class="btn btn-primary btn-sm fw-semibold ff-secondary w-100 text-center text-nowrap">[[admin/admin:save-changes]]</button>
		</div>
	</div>
	<div id="widgets" class="row px-2">
		<div class="col-md-8" id="active-widgets">
			<div class="dropdown mb-3">
				<button class="btn btn-light btn-sm dropdown-toggle" data-bs-toggle="dropdown" aria-expanded="false">
				<span class="selected-template">{templates.0.template}</span> <span class="caret"></span>
				</button>
				<ul class="dropdown-menu {{{ if config.isRTL }}}dropdown-menu-end{{{ end }}} p-1">
					{{{ each templates }}}
					<li><a class="dropdown-item rounded-1" href="#" data-template="{./template}" data-toggle="pill">{./template}</a></li>
					{{{ end }}}
				</ul>
			</div>

			<div class="row">
				<div class="col-12">
					<div class="tab-content">
					{{{ each templates }}}
						<div class="tab-pane {{{ if @first }}}active{{{ end }}}" data-template="{./template}">
						{{{ each templates.areas }}}
							<div class="area" data-template="{templates.template}" data-location="{./location}">
								<h4>{./name} <small>{templates.template} / {./location}</small></h4>
								<div class="card card-body text-bg-light widget-area">

								</div>
							</div>
						{{{ end }}}
						</div>
					{{{ end }}}
					</div>
				</div>
			</div>
		</div>

		<div class="col-md-4">
			<div class="card mb-3">
				<div class="card-header">[[admin/extend/widgets:available]]</div>
				<div class="card-body">
					<div class="available-widgets">
						<p>[[admin/extend/widgets:explanation]]</p>
						{{{ if !availableWidgets.length }}}
						<div class="alert alert-info">[[admin/extend/widgets:none-installed, {config.relative_path}/admin/extend/plugins]]</div>
						{{{ end }}}
						<p>
							<select id="widget-selector" class="form-select">
								{{{ each availableWidgets }}}
								<option value="{./widget}">{./name}</option>
								{{{ end }}}
							</select>
						</p>
						<div class="row">
							{{{ each availableWidgets }}}
							<div class="col-12">
								<div data-widget="{./widget}" class="card widget-panel  pointer hide">
									<div class="card-header">
										<strong>{./name}</strong>
										<small><br />{./description}</small>
									</div>
									<div class="card-body hidden">
										<form>
											{./content}
										</form>
									</div>
								</div>
							</div>
							{{{ end }}}
						</div>

						<div class="btn-group" component="clone">
							<button type="button" class="btn btn-primary" component="clone/button">[[admin/extend/widgets:clone-from]] ...</button>
							<button type="button" class="btn btn-primary dropdown-toggle flex-0" data-bs-toggle="dropdown">
								<span class="caret"></span>
							</button>
							<ul class="dropdown-menu dropdown-menu-end">
								{{{ each templates }}}
								{{{ if !@first }}}
								<li><a class="dropdown-item" href="#">{./template}</a></li>
								{{{ end }}}
								{{{ end }}}
							</ul>
						</div>
					</div>
				</div>
			</div>

			<div class="card">
				<div class="card-header">[[admin/extend/widgets:containers.available]]</div>
				<div class="card-body">
					<p>[[admin/extend/widgets:containers.explanation]]</p>
					<div class="available-containers">
						<div class="containers">
							<div class="pointer" style="padding: 20px; border: 1px dotted #dedede; margin-bottom: 20px;" data-container-html=" ">
								[[admin/extend/widgets:containers.none]]
							</div>
							<div class="card card-header p-3 rounded-0 border-0 shadow-none mb-3 pointer" data-container-html='<div class="card card-header p-3 rounded-0 border-0 shadow-none mb-3">\{{body}}</div>'>
								[[admin/extend/widgets:container.well]]
							</div>
							<div class="card card-header rounded-0 border-0 shadow-none p-5 mb-3 pointer" data-container-html='<div class="card card-header rounded-0 border-0 shadow-none p-5 mb-3">\{{body}}</div>'>
								[[admin/extend/widgets:container.jumbotron]]
							</div>
							<div class="card mb-3" data-container-html='<div class="card"><div class="card-body">\{{body}}</div></div>'>
								<div class="card-body pointer">
									[[admin/extend/widgets:container.card]]
								</div>
							</div>
							<div class="card mb-3 pointer" data-container-html='<div class="card"><h5 class="card-header">\{{title}}</h5><div class="card-body">\{{body}}</div></div>'>
								<div class="card-header d-flex justify-content-between">
									[[admin/extend/widgets:container.card-header]]
									<div class="d-flex gap-1 color-selector">
										<button data-class="text-bg-primary" class="btn btn-sm btn-primary"</button>
										<button data-class="" class="btn btn-sm btn-secondary"</button>
										<button data-class="text-bg-success" class="btn btn-sm btn-success"</button>
										<button data-class="text-bg-info" class="btn btn-sm btn-info"</button>
										<button data-class="text-bg-warning" class="btn btn-sm btn-warning"</button>
										<button data-class="text-bg-danger" class="btn btn-sm btn-danger"</button>
									</div>
								</div>
								<div class="card-body">
									[[admin/extend/widgets:container.card-body]]
								</div>
							</div>

							<div class="alert alert-info pointer" data-container-html='<div class="alert alert-info">\{{body}}</div>'>
								<div class="d-flex justify-content-between">
									[[admin/extend/widgets:container.alert]]
									<div class="d-flex gap-1 color-selector">
										<button data-class="alert-success" class="btn btn-sm btn-success"></button>
										<button data-class="alert-info" class="btn btn-sm btn-info"></button>
										<button data-class="alert-warning" class="btn btn-sm btn-warning"></button>
										<button data-class="alert-danger" class="btn btn-sm btn-danger"></button>
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
</div>