export * from 'ace-builds';

// only import the modes and theme we use
import 'ace-builds/src-noconflict/mode-javascript';
import 'ace-builds/src-noconflict/mode-scss';
import 'ace-builds/src-noconflict/mode-html';
import 'ace-builds/src-noconflict/ext-searchbox';
import 'ace-builds/src-noconflict/theme-twilight';


import htmlWorkerUrl from 'file-loader!ace-builds/src-noconflict/worker-html';
import javascriptWorkerUrl from 'file-loader!ace-builds/src-noconflict/worker-javascript';
import cssWorkerUrl from 'file-loader!ace-builds/src-noconflict/worker-css';

ace.config.setModuleUrl('ace/mode/html_worker', htmlWorkerUrl);
ace.config.setModuleUrl('ace/mode/javascript_worker', javascriptWorkerUrl);
ace.config.setModuleUrl('ace/mode/css_worker', cssWorkerUrl);


