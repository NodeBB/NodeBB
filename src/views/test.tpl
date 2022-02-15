<label>Tags Input</label>
<input id="inputTags" class="form-control" value="" placeholder="">
<hr/>

<label>Birthday</label>
<input id="inputBirthday" class="form-control" value="" placeholder="mm/dd/yyyy">
<hr/>

<label>Auto complete</label>
<input id="autocomplete" class="form-control">
<hr/>

<label>Color Picker</label>
<input id="colorpicker" type="color" class="form-control">
<hr/>

<label>Timeago</label>
<div>
    <label>Language is [[language:name]]</label>
    <br/>
<span id="timeago" class="timeago" title="{now}"></span>
<button id="change-language" type="button" class="btn btn-primary">Change Language</button>
</div>
<hr/>

<label>Change Skin</label>
<select id="change-skin" class="form-control">
	{{{each skins}}}
	<option value="{skins.value}">{skins.name}</option>
	{{{end}}}
</select>
<hr/>

<label>Sortable</label>
<div>
	<ul id="sortable-list">
		<li>Item 1</li>
		<li>Item 2</li>
		<li>Item 3</li>
	</ul>
</div>
<hr/>

<label>Form Serialize</label>
<form id="form-serialize">
	<input name="a" value="1">
	<input name="a" value="2">
	<input name="bar" value="test">
</form>
<pre id="json-form-data"></pre>
<hr/>

<label>Form Deserialize</label>
<form id="form-deserialize">
	<input name="foo" value="">
	<input name="foo" value="">
	<input name="moo" value="">
</form>
<hr/>