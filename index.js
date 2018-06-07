const fs = require('fs');
const path = require('path');

const loaderUtils = require('loader-utils');
const replaceAsync = require('string-replace-async');

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

function replaceGLSL(match, includePath, chunksPath, chunksExt, loader) {
  includePath = includePath.trim().replace(/;|<|>/ig, '');

  const ext = path.extname(includePath);
  if(!ext) includePath = `${includePath}.${chunksExt}`;

  const context = path.dirname(loader.resource);

  return resolveDependency(loader, context, includePath)
    .catch(err => { })

    .then(chunkPath => {
      if (chunkPath) {
        loader.addDependency(chunkPath);
        return readFile(chunkPath, 'utf-8');
      }

      return resolveDependency(loader, path.resolve(context, chunksPath), includePath)
        .then(chunkPath => {
          loader.addDependency(chunkPath);
          return readFile(chunkPath, 'utf-8');
        })
    })

    .then(file => {
      return file.content;
    });
}

function includeGLSLFile(source, chunksPath, chunksExt, loader, currentPath = './') {
  const include = /#include(\s+)[^<](.+)[^>]/;
  const callback = loader.async();

  if (source.includes('/*') && source.includes('*/')) {
    source.slice(0, source.indexOf('/*')) + source.slice(source.indexOf('*/') + 2, source.length);
  }

  const shader = source.split('\n');

  for (let i = 0; i < shader.length; i++) {
    if (shader[i].includes('//')) {
      shader[i] = '';
    }
  }

  source = shader.join('\n');

  if (include.test(source)) {
    replaceAsync(source, /#include (.*);/ig, (match, includePath) => {
      const pathIndex = includePath.trim().lastIndexOf('/');

      if (pathIndex !== -1) {
        currentPath = includePath.slice(0, pathIndex + 1);
        includePath = includePath.slice(pathIndex + 1, includePath.length);
      }

      return replaceGLSL(match, currentPath + includePath, chunksPath, chunksExt, loader);
    })

    .then(res => {
      includeGLSLFile(res, chunksPath, chunksExt, loader, currentPath);
    })

    .catch(err => {
      callback(err);
    })
  } else {
    callback(null, `module.exports = \'${source.replace(new RegExp('\n', 'gm'), '\\n').replace(new RegExp('\r', 'gm'), '\\r').replace(new RegExp('\'', 'gm'), '\\\'')}\';`);
  }
}

function transformChunks(source, {chunksPath, chunksExt}, loader) {
  loader.cacheable();

  const THREE_SHADER = path.dirname(loader.resource).includes('ShaderLib') ||
                       path.dirname(loader.resource).includes('ShaderChunk');

  if (THREE_SHADER) {
    const callback = loader.async();

    if (source.indexOf('#include') !== -1) {
      replaceAsync(source, /#include (.*);/ig, (match, includePath) => {
        includePath = './' + includePath.trim().replace(/;|<|>|.\//ig, '');

        const ext = path.extname(includePath);
        if(!ext) includePath = `${includePath}.${chunksExt}`;

        const context = path.dirname(loader.resource);

        return resolveDependency(loader, context, includePath)
          .catch(err => { })

          .then(chunkPath => {
            if (chunkPath) {
              loader.addDependency(chunkPath);
              return readFile(chunkPath, 'utf-8');
            }

            return resolveDependency(loader, path.resolve(context, chunksPath), includePath)
              .then(chunkPath => {
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
        })

        .catch(err => {
          callback(err)
        })
    } else {
      callback(null, `module.exports = \'${source.replace(new RegExp('\n', 'gm'), '\\n').replace(new RegExp('\r', 'gm'), '\\r').replace(new RegExp('\'', 'gm'), '\\\'')}\';`);
    }
  } else {
    includeGLSLFile(source, chunksPath, chunksExt, loader);    
  }
}

module.exports = function(source) {
  const options = loaderUtils.getOptions(this) || {}
  const chunksPath = options.chunksPath || DEFAULT_CHUNKS_PATH;
  const chunksExt = options.chunksExt || DEFAULT_CHUNKS_EXT;
  transformChunks(source, {chunksPath, chunksExt}, this);
};
