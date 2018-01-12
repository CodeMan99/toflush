var test = require('tape');
var toflush = require('../toflush.js');
var stream = require('stream');

var PassThrough = stream.PassThrough;
var Readable = stream.Readable;

// force test to fail if a promise went unhandled.
process.on('unhandledRejection', reason => {
	console.error(reason.stack || reason);
	throw new Error('Unhandled Promise rejection: ' + reason.message || reason);
});

function MockVinyl(options) {
	Object.assign(this, options);
}

MockVinyl.prototype.isStream = function() {
	// an invalid check, but will work for the test purposes
	return !Buffer.isBuffer(this.contents);
};

var imageminMock = {
	buffer: buf => Promise.resolve(buf)
};

function readableFrom(str) {
	var contents = new Readable();

	contents.push(str, 'utf8');
	contents.push(null);

	return contents;
}

test('callback arguments', t => {
	var readable = new Readable({objectMode: true});

	readable.pipe(toflush(items => {
		t.equal(Array.isArray(items), true, 'received array of items');
		t.equal(items.length, 3, 'received three items');
		t.equal(items[0].value, 0, 'first item is correct');
		t.equal(items[1].value, 1, 'second item is correct');
		t.equal(items[2].value, 2, 'third item is correct');
		t.end();
	}));

	readable.push({value: 0});
	readable.push({value: 1});
	readable.push({value: 2});
	readable.push(null);
});

test('concat items, sync', t => {
	var readable = new Readable({objectMode: true});

	t.plan(1);

	readable.pipe(toflush(items => {
		var values = [];

		for (var item of items) {
			values.push(item.value);
		}

		return {values: values};
	})).pipe(new PassThrough({
		objectMode: true,
		transform: (obj, _, next) => {
			t.deepEqual(obj, {values: [0, 1, 2, 3]});
			next(null);
		}
	}));

	readable.push({value: 0});
	readable.push({value: 1});
	readable.push({value: 2});
	readable.push({value: 3});
	readable.push(null);
});

test('map items, sync', t => {
	var readable = new Readable({objectMode: true});
	var hexColor = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/;
	var expected = [
		'rgb(255, 0, 255)',
		'rgb(0, 255, 255)'
	];

	t.plan(expected.length);

	readable.pipe(toflush(items => {
		var m, r, g, b;

		for (var item of items) {
			m = item.color.match(hexColor);

			if (m) {
				[_, r, g, b] = m;
				item.rgb = `rgb(${parseInt(r, 16)}, ${parseInt(g, 16)}, ${parseInt(b, 16)})`;
			} else {
				throw new Error('incorrect color format, use #000000 style');
			}
		}

		return items;
	})).pipe(new PassThrough({
		objectMode: true,
		transform: (obj, _, next) => {
			t.equal(obj.rgb, expected.shift());
			next(null);
		}
	}));

	readable.push({color: '#ff00ff'});
	readable.push({color: '#00ffff'});
	readable.push(null);
});

test('filter items, sync', t => {
	var readable = new Readable({objectMode: true});
	var expected = [{value: 2}, {value: 4}];

	t.plan(expected.length);

	readable.pipe(toflush(items => {
		var result = [];

		for (var item of items) {
			if (item.value % 2 === 0) {
				result.push(item);
			}
		}

		return result;
	})).pipe(new PassThrough({
		objectMode: true,
		transform: (obj, _, next) => {
			t.deepEqual(obj, expected.shift());
			next(null);
		}
	}));

	readable.push({value: 1});
	readable.push({value: 2});
	readable.push({value: 3});
	readable.push({value: 4});
	readable.push({value: 5});
	readable.push(null);
});

test('duplicate items, sync', t => {
	var readable = new Readable({objectMode: true});
	var expected = [{value: 1}, {value: 1}, {value: 2}, {value: 2}];

	t.plan(expected.length);

	readable.pipe(toflush(items => {
		var result = [];

		for (var item of items) {
			result.push(item, item);
		}

		return result;
	})).pipe(new PassThrough({
		objectMode: true,
		transform: (obj, _, next) => {
			t.deepEqual(obj, expected.shift());
			next(null);
		}
	}));

	readable.push({value: 1});
	readable.push({value: 2});
	readable.push(null);
});

test('thrown error', t => {
	var readable = new Readable();

	readable.pipe(toflush(() => { throw new Error('test error'); }))
		.on('error', err => {
			t.equal(err.message, 'toflush: test error', 'handled error in stream event');
			t.end();
		});

	readable.push(null);
});

test('thrown error, no stream handler', t => {
	var readable = new Readable();

	process.once('uncaughtException', err => {
		t.equal(err && err.message, 'toflush: test error, unhandled', 'unhandled error from stream');
		t.end();
	});

	readable.pipe(toflush(() => { throw new Error('test error, unhandled'); }));
	readable.push(null);
});

test('map items, async', t => {
	var readable = new Readable({objectMode: true});
	var expected = [
		new MockVinyl({
			path: '/tmp/toflush/pref.js',
			contents: Buffer.from('// Copyright 2020 Some Dude <some.dude@example.com>\n\nmodule.exports = function iLikeSpaces() {\n  return true;\n};\n')
		}),
		new MockVinyl({
			path: '/tmp/toflush/mulpfile.js',
			contents: Buffer.from('// Copyright 2020 Some Dude <some.dude@example.com>\n\nvar mulp = require("mulp");\n\nmulp.task("default", []);\n')
		})
	];

	t.plan(expected.length);

	readable.pipe(toflush(items => {
		return new Promise((resolve, reject) => {
			// pretend this is read from disk or network
			var header = Buffer.from('// Copyright 2020 Some Dude <some.dude@example.com>\n\n');

			for (var item of items) {
				item.contents = Buffer.concat([header, item.contents]);
			}

			resolve(items);
		});
	})).pipe(new PassThrough({
		objectMode: true,
		transform: (obj, _, next) => {
			t.deepEqual(obj, expected.shift());
			next(null);
		}
	}));

	readable.push(new MockVinyl({
		path: '/tmp/toflush/pref.js',
		contents: Buffer.from('module.exports = function iLikeSpaces() {\n  return true;\n};\n')
	}));
	readable.push(new MockVinyl({
		path: '/tmp/toflush/mulpfile.js',
		contents: Buffer.from('var mulp = require("mulp");\n\nmulp.task("default", []);\n')
	}));
	readable.push(null);
});

test('filter items, async', t => {
	var readable = new Readable({objectMode: true});
	var expected = [
		new MockVinyl({
			path: '/tmp/toflush/small.png',
			contents: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKAQMAAAC3/F3+AAAABlBMVEUAAAD///+l2Z/dAAAAD0lEQVQI12NggAE5JAQDAAdiAHlBslFeAAAAAElFTkSuQmCC', 'base64')
		})
	];

	t.plan(expected.length);

	readable.pipe(toflush(items => {
		var result = [];

		for (var item of items) {
			if (item.contents.byteLength < 91) {
				var p = (image => imageminMock.buffer(image.contents).then(buffer => {
					image.contents = buffer;
					return image;
				}))(item);

				result.push(p);
			}
		}

		return Promise.all(result);
	})).pipe(new PassThrough({
		objectMode: true,
		transform: (obj, _, next) => {
			t.deepEqual(obj, expected.shift());
			next(null);
		}
	}));

	readable.push(new MockVinyl({
		path: '/tmp/toflush/small.png',
		contents: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKAQMAAAC3/F3+AAAABlBMVEUAAAD///+l2Z/dAAAAD0lEQVQI12NggAE5JAQDAAdiAHlBslFeAAAAAElFTkSuQmCC', 'base64')
	}));
	readable.push(new MockVinyl({
		path: '/tmp/toflush/medium.png',
		contents: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAABQAAAAUAQMAAAC3R49OAAAABlBMVEUAAAD///+l2Z/dAAAAEUlEQVQI12NgwAGY/+DHOAAAPzcH+fYjMKAAAAAASUVORK5CYII=', 'base64')
	}));
	readable.push(new MockVinyl({
		path: '/tmp/toflush/large.png',
		contents: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAACgAAAAoAQMAAAC2MCouAAAABlBMVEUAAAD///+l2Z/dAAAAE0lEQVQI12NgoBbg//+BpiR1AADksh/hQ1/YMAAAAABJRU5ErkJggg==', 'base64')
	}));
	readable.push(null);
});

test('duplicate items, async', t => {
	var readable = new Readable({objectMode: true});
	var expected = [
		new MockVinyl({
			path: '/tmp/toflush/index.js',
			contents: Buffer.from('#!/usr/bin/env node\n\nconst fetch = require("node-fetch");\n\nexport default () => fetch("http://example.com/index.js");\n')
		}),
		new MockVinyl({
			path: '/tmp/toflush/.index.js.githistory',
			contents: Buffer.from('073421a Initial Commit\n8436ab3 Export function as default.\n')
		})
	];

	t.plan(expected.length);

	readable.pipe(toflush(items => {
		var p = Promise.resolve();

		return p.then(() => { // lets say, we ran `execa('git', ['log', '--', items[0].path])`
			items.push(new MockVinyl({
				path: '/tmp/toflush/.index.js.githistory',
				contents: Buffer.from('073421a Initial Commit\n8436ab3 Export function as default.\n')
			}));

			return items;
		});
	})).pipe(new PassThrough({
		objectMode: true,
		transform: (obj, _, next) => {
			t.deepEqual(obj, expected.shift());
			next(null);
		}
	}));

	readable.push(new MockVinyl({
		path: '/tmp/toflush/index.js',
		contents: Buffer.from('#!/usr/bin/env node\n\nconst fetch = require("node-fetch");\n\nexport default () => fetch("http://example.com/index.js");\n')
	}));
	readable.push(null);
});

test('rejected error', t => {
	var readable = new Readable();

	readable.pipe(toflush(() => Promise.reject('test rejection')))
		.on('error', err => {
			t.equal(err.message, 'toflush: test rejection', 'handled error in stream event');
			t.end();
		});

	readable.push(null);
});

test('rejected error, no stream handler', t => {
	var readable = new Readable();

	process.once('uncaughtException', err => {
		t.equal(err && err.message, 'toflush: test rejection, unhandled', 'unhandled rejection from stream');
		t.end();
	});

	readable.pipe(toflush(() => Promise.reject('test rejection, unhandled')));
	readable.push(null);
});

test('callback option', t => {
	var readable = new Readable({objectMode: true});

	readable.pipe(toflush({
		callback: items => {
			t.equal(Array.isArray(items), true, 'received an array');
			t.equal(items.length, 3, 'three items');
			t.end();
		}
	}));

	readable.push({value: '01'});
	readable.push({value: '10'});
	readable.push({vaule: '11'});
	readable.push(null);
});

test('callback name', t => {
	var readable = new Readable();

	readable.pipe(toflush(function customname(items) { throw new Error('is cool'); }))
		.on('error', err => {
			t.equal(err.message, 'customname: is cool', 'function name is used in error');
			t.end();
		});

	readable.push(null);
});

test('name option', t => {
	var readable = new Readable();

	readable.pipe(toflush({
		name: 'namefromoptions',
		callback: function dopedname(items) { throw new Error('is used'); }
	})).on('error', err => {
		t.equal(err.message, 'namefromoptions: is used', 'option name is used in error');
		t.end();
	});

	readable.push(null);
});

test('stream option', t => {
	var readable = new Readable({objectMode: true});

	readable.pipe(toflush({
		stream: true,
		callback: items => {
			t.equal(Array.isArray(items), true, 'items is an array');
			t.equal(items.length, 1, 'array contains one item');
			t.equal(items[0].path, '/tmp/toflush/0123.txt', 'item has not changed');
			t.end();
		}
	})).on('error', err => {
		t.fail(err.message);
		t.end();
	});

	readable.push(new MockVinyl({
		path: '/tmp/toflush/0123.txt',
		contents: readableFrom('A cool test file\n')
	}));
	readable.push(null);
});

test('content stream without option', t => {
	var readable = new Readable({objectMode: true});

	readable.pipe(toflush(items => {})).on('error', err => {
		t.equal(err.message, 'toflush: content streams are not enabled', 'stream error');
		t.end();
	});

	readable.push(new MockVinyl({
		path: '/tmp/toflush/5678.txt',
		contents: readableFrom('Another cool test file\n')
	}));
	readable.push(null);
});
