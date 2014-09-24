
<div class="sounds">
	<h1><i class="fa fa-volume-up"></i> Sounds</h1>
	<hr />
	<p>
		Sounds for various actions in NodeBB can be configured here.
	</p>

	<form role="form">
		<div class="panel panel-default">
			<div class="panel-heading">General</div>
			<div class="panel-body">
				<label for="notification">Notifications</label>
				<div class="row">
					<div class="form-group col-xs-9">
						<select class="form-control" id="notification" name="notification">
							<!-- BEGIN sounds -->
							<option value="{sounds.name}">{sounds.name}</option>
							<!-- END sounds -->
						</select>
					</div>
					<div class="btn-group col-xs-3">
						<button type="button" class="form-control btn btn-sm btn-default" data-action="play">Play <i class="fa fa-play"></i></button>
					</div>
				</div>
			</div>
		</div>

		<div class="panel panel-default">
			<div class="panel-heading">Chat</div>
			<div class="panel-body">
				<label for="chat-incoming">Incoming Message</label>
				<div class="row">
					<div class="form-group col-xs-9">
						<select class="form-control" id="chat-incoming" name="chat-incoming">
							<!-- BEGIN sounds -->
							<option value="{sounds.name}">{sounds.name}</option>
							<!-- END sounds -->
						</select>
					</div>
					<div class="btn-group col-xs-3">
						<button type="button" class="form-control btn btn-sm btn-default" data-action="play">Play <i class="fa fa-play"></i></button>
					</div>
				</div>

				<label for="chat-outgoing">Outgoing Message</label>
				<div class="row">
					<div class="form-group col-xs-9">
						<select class="form-control" id="chat-outgoing" name="chat-outgoing">
							<!-- BEGIN sounds -->
							<option value="{sounds.name}">{sounds.name}</option>
							<!-- END sounds -->
						</select>
					</div>
					<div class="btn-group col-xs-3">
						<button type="button" class="form-control btn btn-sm btn-default" data-action="play">Play <i class="fa fa-play"></i></button>
					</div>
				</div>
			</div>
		</div>
	</form>
</div>

<button class="btn btn-primary" id="save">Save</button>