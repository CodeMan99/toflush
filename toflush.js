var Transform = require('stream').Transform;

/**
 * @module toflush
 * @type {function}
 */
module.exports = toflush;

/**
 * <p>Should process all objects in the stream in one go, and return either
 * values synchronously or a via Promise.</p>
 *
 * <p>Any thrown error or rejected value will be emitted to the stream.</p>
 *
 * @callback module:toflush~callback
 * @this {stream.Transform}
 * @param {Object[]} items the objects read from the stream
 * @returns {Object|Object[]|Promise<Object>|Promise<Object[]>}
 */

/**
 * @typedef module:toflush~options
 * @property {module:toflush~callback} callback
 * @property {string} [name] an optional name to use in error states
 * @property {boolean} [stream=false] whether to receive objects with content streams
 */

/**
 * <p>Collects all the objects in a stream and passes them as an Array to the
 * given function.</p>
 *
 * <p>By default content streams cause an error state. To receive content
 * streams set the <code>stream</code> option to <code>true</code>. Note you
 * must manually handle streams.</p>
 *
 * @example <caption>Concatinate Files</caption>
 * gulp.src('*.txt')
 * 	.pipe(toflush(files => {
 * 		var buffers = [];
 * 		for (var f of files) {
 * 			buffers.push(f.contents);
 * 		}
 * 		return new Vinyl({
 * 			path: 'all.txt',
 * 			contents: Buffer.concat(buffers)
 * 		});
 * 	}))
 * 	.pipe(gulp.dest('out'));
 *
 * @example <caption>Add a Header Line</caption>
 * gulp.src('*.js')
 * 	.pipe(toflush(files => {
 * 		for (var file of files) {
 * 			file.contents = Buffer.concat([Buffer.from('// copyright 2018\n'), f.contents]);
 * 		}
 * 		return files;
 * 	}))
 * 	.pipe(gulp.dest('out'));
 *
 * @example <caption>With Streams</caption>
 * gulp.src('*.js')
 * 	.pipe(toflush({
 * 		callback: files => {
 * 			var archive = new yazl.ZipFile();
 * 			for (var file of files) {
 * 				archive.addReadStream(file.contents, file.relative);
 * 			}
 * 			archive.end();
 * 			return new File({path: 'source.zip', contents: archive.outputStream});
 * 		},
 * 		name: 'createZip',
 * 		stream: true
 * 	}))
 * 	.pipe(gulp.dest('out'));
 *
 * @example <caption>Read From Remote</caption>
 * gulp.src('*.js', {read: false})
 * 	.pipe(toflush(files => Promise.all(files.map(file => {
 * 		return fetch('http://example.com/download/' + file.relative).then(response => {
 * 			if (response.ok) return response.buffer();
 * 			throw new Error(`${response.status} ${response.statusText} (${file.relative})`);
 * 		}).then(buffer => {
 * 			file.contents = buffer;
 * 			return file;
 * 		});
 * 	}))))
 * 	.on('error', gutil.log)
 * 	.pipe(gulp.dest('.'));
 *
 * @param {module:toflush~options|module:toflush~callback} options
 * @returns {stream.Transform} a through stream
 */
function toflush(options) {
	var items = [];
	var callback;
	var name;

	if (typeof options == 'function') {
		callback = options;
		options = {stream: false};
	} else {
		callback = options && options.callback;

		if (typeof callback != 'function') {
			throw new TypeError('callback must be a function');
		}
	}

	name = options.name || callback.name || toflush.name;

	return new Transform({
		objectMode: true,
		transform: function(obj, _, next) {
			// make vinyl content streams an opt-in switch
			if (typeof obj.isStream == 'function' && obj.isStream() && !options.stream) {
				next(new Error(name + ': content streams are not enabled'));
			} else {
				items.push(obj);
				next(null);
			}
		},
		flush: function(done) {
			var stream = this;

			new Promise(resolve => resolve(callback.call(stream, items))).then(result => {
				if (Array.isArray(result)) {
					for (var r of result) {
						stream.push(r);
					}
				} else {
					stream.push(result);
				}

				done(null);
			}).catch(err => {
				var copy = err instanceof Error ? err : new Error();

				copy.message = name + ': ' + (err.message || err);
				// emit error in next tick to avoid re-thrown errors being caught by promise
				setImmediate(() => done(copy));
			});
		}
	});
}
