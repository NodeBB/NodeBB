<div class="mb-3">
	<label class="form-label" for="invite-modal-emails">[[users:prompt-email]]</label>
	<input id="invite-modal-emails" type="text" class="form-control" placeholder="friend1@example.com,friend2@example.com" />
</div>
<div class="">
	<label class="form-label" for="invite-modal-groups">[[users:groups-to-join]]</label>
	<select id="invite-modal-groups" class="form-control" multiple size="5">
		{{{ each groups }}}
		<option value="{@value}">{@value}</option>
		{{{ end }}}
	</select>
</div>