const fs = require('fs');
const path = require('path');
const loaderUtils = require("loader-utils");
const replaceAsync = require("string-replace-async");

const DEFAULT_CHUNKS_EXT = 'glsl';
const DEFAULT_CHUNKS_PATH = '../ShaderChunk';

function resolveDependency(loader, context, chunkPath) {
  return new Promise((resolve, reject) => {
    loader.resolve(context, chunkPath, (err, res) => {
      if(err) reject(err);
      else resolve(res);
    });
  });
}

function readFile(filePath, options) {
  return new Promise((resolve, reject) => {
    fs.readFile(filePath, options, (err, content) => {
      if(err) return reject(err);
      return resolve({
        path: filePath,
        content
      });
    });
  });
}

function transformChunks(source, {chunksPath, chunksExt}, loader) {
  loader.cacheable();
  const callback = loader.async();

  if (source.indexOf('#include') !== -1) {
    // some includes detected, replace them (asyncronously)

    replaceAsync(source,/#include (.*);/ig, (match, includePath) => {
      includePath = './' + includePath.trim().replace(/;|<|>|.\//ig, '');

      const ext = path.extname(includePath);
      if(!ext) includePath = `${includePath}.${chunksExt}`;

      const context = path.dirname(loader.resource)

      return resolveDependency(loader, context, includePath)
        .catch(err => {
          // catch this, we'll retry with chunkPath
        })
        .then(chunkPath => {
          if (chunkPath) {
            // load was successful
            loader.addDependency(chunkPath);
            return readFile(chunkPath, 'utf-8');
          }
          // no cigar, retry chunkPath
          return resolveDependency(loader, path.resolve(context, chunksPath), includePath)
            .then(chunkPath => {
              // success
              loader.addDependency(chunkPath);
              return readFile(chunkPath, 'utf-8');
            })
        })
        .then(file => {
          return file.content
        });
      })
      .then(res => {
        callback(null, `module.exports = \'${res.replace(new RegExp('\n', 'gm'), '\\n').replace(new RegExp('\r', 'gm'), '\\r').replace(new RegExp('\'', 'gm'), '\\\'')}\';`)
      }).catch(err => {
        callback(err)
      })
  } else {
    // no includes, return string as it is
    callback(null, `module.exports = \'${source.replace(new RegExp('\n', 'gm'), '\\n').replace(new RegExp('\r', 'gm'), '\\r').replace(new RegExp('\'', 'gm'), '\\\'')}\';`);
  }
}

module.exports = function(source) {
  const options = loaderUtils.getOptions(this) || {}
  const chunksPath = options.chunksPath || DEFAULT_CHUNKS_PATH;
  const chunksExt = options.chunksExt || DEFAULT_CHUNKS_EXT;
  transformChunks(source, {chunksPath, chunksExt}, this);
};
