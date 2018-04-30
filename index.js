const fs = require('fs');
const path = require('path');
const loaderUtils = require("loader-utils");
const replaceAsync = require("string-replace-async");

const DEFAULT_ROOT_PATH = '/';
const DEFAULT_CHUNKS_EXT = 'glsl';
const DEFAULT_VAR_PREFIX = '$';

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

function transformChunks(source, {rootPath, chunksExt}, loader) {
  loader.cacheable();
  const callback = loader.async();

  if (source.indexOf('#include') !== -1) {
    // some includes detected, replace them (asyncronously)

    replaceAsync(source,/#include (.*);/ig, (match, includePath) => {
      includePath = './' + includePath.trim().replace(/;|<|>|.\//ig, '');
      // console.log(includePath)

      const ext = path.extname(includePath);
      if(!ext) includePath = `${includePath}.${chunksExt}`;

      const isAbsolute = path.isAbsolute(includePath);

      const context = isAbsolute ? path.resolve(rootPath) : path.dirname(loader.resource);

      if (isAbsolute) includePath = `.${includePath}`;

      // console.log('\n\nTRYING FIRST TIME')
      return resolveDependency(loader, context, includePath)
        .catch(err => {
          // console.log('\n\nFAILED')
        })
        .then(chunkPath => {
          if (chunkPath) {
            // console.log('\n\nSUCCESS')
            loader.addDependency(chunkPath);
            return readFile(chunkPath, 'utf-8');
          }

          // console.log('\n\nTRYING SECOND TIME')
          return resolveDependency(loader, path.resolve(path.dirname(loader.resource), '../ShaderChunk'), includePath)
            .then(chunkPath => {
              // console.log('\n\nSUCCESS SECOND TIME!')
              loader.addDependency(chunkPath);
              return readFile(chunkPath, 'utf-8');
            })
        })
        .then(file => {
          // console.log('\n\nRETURNING READ FILE')
          return file.content
        });
      })
      .then(res => {
        // console.log(`\n\nmodule.exports = \`${res}\`;`);
        callback(null, `module.exports = \`${res}\`;`)
      }).catch(err => {
        // console.log(`\n\nERROR ${err}`);
        callback(err)
      })
  } else {
    // so includes, return string as it is
    callback(null, `module.exports = \`${source}\`;`);
  }
}

module.exports = function(source) {
  const options = loaderUtils.getOptions(this) || {}
  const rootPath = (options.glsl && options.glsl.rootPath) || DEFAULT_ROOT_PATH;
  const chunksExt = (options.glsl && options.glsl.chunksExt) || DEFAULT_CHUNKS_EXT;
  transformChunks(source, {rootPath, chunksExt}, this);
};
