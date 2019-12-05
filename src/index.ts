import { editor, languages } from 'monaco-editor';
import { fromEvent, Observable } from 'rxjs';
import { shareReplay, debounceTime, startWith, skip, distinctUntilChanged, retryWhen, delay, map } from 'rxjs/operators';

import { V2XmlFormatter } from '~../lib/vscode-xml/src/formatting/formatters';

const formatter = new V2XmlFormatter;
const formatterOptions = {
	removeCommentsOnMinify: false,
	splitAttributesOnFormat: false,
	splitXmlnsOnFormat: false,
	enforcePrettySelfClosingTagOnFormat: true,
	newLine: '\n'
};

languages.registerDocumentRangeFormattingEditProvider( 'xml', {
	provideDocumentRangeFormattingEdits( model, range, editorOptions ) {
		return [ {
			range,
			text: formatter.formatXml( model.getValueInRange( range ), {
				...formatterOptions,
				editorOptions
			} )
		} ];
	}
} );
languages.registerDocumentFormattingEditProvider( 'xml', {
	provideDocumentFormattingEdits( model, editorOptions ) {
		return [ {
			range: model.getFullModelRange(),
			text: formatter.formatXml( model.getValue(), {
				...formatterOptions,
				editorOptions
			} )
		} ];
	}
} );

const options = {
	tabSize: 2,
	indentSize: 2,
	insertSpaces: false,
	trimAutoWhitespace: true
};

self[ 'MonacoEnvironment' ] = {
	getWorkerUrl( moduleId, label ) {
		switch( label ) {
		default: return './editor.worker.js';
		}
	}
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
	svgEditor.trigger( 'index.ts', 'editor.action.formatDocument', {} );
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
	} ).pipe( shareReplay( 1 ), distinctUntilChanged(), debounceTime( 10 ) );

	content
	.pipe( skip( 1 ) )
	.subscribe( c => {
		storage.setItem( 'content', c );
	} );

	content
	.pipe(
		map( str => ( new DOMParser ).parseFromString( str, 'image/svg+xml' ) ),
		map( doc => ( new XMLSerializer ).serializeToString( doc ) ),
		map( str => 'data:image/svg+xml;base64,' + btoa( str ) ),
		distinctUntilChanged(),
		retryWhen( e => e.pipe( delay( 100 ) ) )
	)
	.subscribe( url => {
		( document.getElementById( 'image' ) as HTMLImageElement ).src = url;
		svgSource.setValue( url );
	} );

} )();
