# toflush [![Build Status](https://travis-ci.org/CodeMan99/toflush.svg?branch=master)](https://travis-ci.org/CodeMan99/toflush)

Transform on Flush. Process an entire object mode stream in a single
function call.

## Install

    npm install --save toflush

## Usage

May have a synchronous callback.

    fs.createReadStream('./rows.db') // newline delimited json
      .pipe(split(JSON.parse))
      .pipe(toflush(JSON.stringify))
      .pipe(fs.createWriteStream('./database.json')) // write out as a JSON array

May have a asynchronous, Promise returning, callback.

    fs.createReadStream('./images.db')
      .pipe(split(JSON.parse))
      .pipe(toflush(items => {
        return fetch(items[0].url).then(response => {
          if (response.ok) {
            return response.buffer();
          }

          throw new Error(`${response.status} ${response.statusText}`);
        });
      })
      .on('error', error => /* handle fetch or response error */)
      .pipe(fs.createWriteStream('./first.png'));

There are more examples available in the documentation and in the test cases.

## API

A single function that receives either an options object or a callback.

### toflush(options) -> stream.Transform

 * `options.callback` - function that receives all objects from the stream
   as the first argument. Should return an object, array, or a promise. More
   detail [below](#toflushcallback---streamtransform).
 * `options.name` - String name to use in error message. Default `toflush`. May
   also be provide by the callback name.
 * `options.stream` - Boolean sanity flag that makes [vinyl][] content streams
   opt-in.

### toflush(callback) -> stream.Transform

Same as the callback in the options above. Any thrown error or rejection is
emitted by the stream.

 * `callback(items) -> Object` - take all objects, and return a single object.
 * `callback(items) -> Object[]` - take all objects, and return any number of
   objects. May be the same, more, or less than the input. Each item is pushed
   into the stream, not the array.
 * `callback(items) -> Promise<Object>` - take all objects, and _then_ promise
   a single object.
 * `callback(items) -> Promise<Object[]>` - take all objects, and _then_
   promise any number of objects. May be the same, more, or less than the
   input. Each item is pushed into the stream, not the array.

## Required

You must be using node.js v4.x or later. This module has no dependencies,
taking advantage of the improved `stream.Transform` implementation.

## Related

 * [vinyl][] - virtual file format, used heavily by `gulp`.
 * [get-stream][] - get stream as a string, buffer, or array.
 * [through2][] - older general stream utility. Heavily inspired this project.

## License

MIT &copy; Cody A. Taylor 2018

[vinyl]: https://github.com/gulpjs/vinyl "gulpjs/vinyl"
[get-stream]: https://github.com/sindresorhus/get-stream "sindresorhus/get-stream"
[through2]: https://github.com/rvagg/through2 "rvagg/through2"
