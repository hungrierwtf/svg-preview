import { editor } from 'monaco-editor';
import { fromEvent, Observable } from 'rxjs';
import { shareReplay, debounceTime, startWith, skip } from 'rxjs/operators';
import 'monaco-languages/release/esm/xml/xml.contribution';
const options = {
	tabSize: 2,
	indentSize: 2,
	insertSpaces: false,
	trimAutoWhitespace: true
};

const storage = localStorage;

( async () => {
	const svgEditor = editor.create( document.getElementById( 'editor' ), {
		value: storage.getItem( 'content' ) ?? `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
</svg>
`,
		language: 'xml',
		renderWhitespace: 'boundary'
	} );
	const model = svgEditor.getModel();
	model.updateOptions( options );

	const svgSource = editor.create( document.getElementById( 'source' ), {
		renderWhitespace: 'boundary',
		codeLens: false,
		lineNumbers: 'off',
		minimap: {
			enabled: false
		},
		readOnly: true,
		wordWrap: 'on'
	} );
	svgSource.getModel().updateOptions( options );

	fromEvent( window, 'resize', { passive: true } )
	.pipe(
		startWith( {} ),
		debounceTime( 10 ) )
	.subscribe( () => {
		svgEditor.layout();
		svgSource.layout();
	} );

	const content = new Observable<string>( observer => {
		observer.next( model.getValue() );
		model.onDidChangeContent( () => {
			observer.next( model.getValue() );
		} );
		return () => {};
	} ).pipe( shareReplay( 1 ) );

	content
	.pipe( skip( 1 ), debounceTime( 10 ) )
	.subscribe( c => {
		storage.setItem( 'content', c );
	} );

	content
	.pipe( debounceTime( 10 ) )
	.subscribe( e => {
		const dataUrl = 'data:image/svg+xml;base64,' + btoa( e );
		( document.getElementById( 'image' ) as HTMLImageElement ).src = dataUrl;
		svgSource.setValue( dataUrl );
	} );

} )();
