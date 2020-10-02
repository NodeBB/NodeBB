<li data-type="item" class="list-group-item">
    <div class="row">
        <div class="col-xs-9">
            <span class="label label-primary">{{{ if uid }}}uid {uid}{{{ else }}}master{{{ end }}}</span>
            {{{ if token }}}<input type="text" readonly="readonly" value="{token}" size="32" />{{{ else }}}<em class="text-warning">Token will be generated once form is saved</em>{{{ end }}}<br />
            <small>{description}</small>
        </div>
        <div class="col-xs-3 text-right">
            <button type="button" data-type="edit" class="btn btn-info">Edit</button>
            <button type="button" data-type="remove" class="btn btn-danger">Delete</button>
        </div>
    </div>
</li>