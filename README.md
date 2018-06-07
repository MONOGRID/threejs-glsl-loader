# threejs-glsl-loader
A Webpack Loader that allows to load threejs inlined GLSL chunks.

ALPHA VERSION, Tested with Threejs r92 

## Webpack Configuration

``` js
module: {
  rules: [{
    test: /\.(glsl|vert|frag)$/,
    loader: 'threejs-glsl-loader',
    // Default values (can be omitted)
    options: {
      chunksPath: '../ShaderChunk', // if chunk fails to load with provided path (relative), the loader will retry with this one before giving up
      chunksExt: 'glsl', // Chunks extension, used when #import statement omits extension
    }
  }]
}
```

## How it behaves

``` glsl
// The content of chunks/a-chunk.glsl file will be inlined here as string
// the loader will first try to load from the specified path (relative to the current glsl file)
// Please, do not specify `./` if the additional file you're going to load resides in the same directory,
// this will give an error. However, adding `../` will let you move to upper level folder to search required file in there.
#include chunks/a-chunk.glsl;

// This is how Three.js specifies its chunks in its .glsl files
// the loader will ignore <> characters and append chunksExt
// the loader will then try to load the chunk from the same folder as the current glsl file
// if this fails it will try to load the chunk from the specified chunksPath config argument
// the default '../ShaderChunk' value for chunksPath currently (three.js r92) maps to where chunks are located in three.js
#include <a-chunk>;

```
