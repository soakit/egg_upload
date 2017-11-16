'use strict';

module.exports = appInfo => ({
  debug: false,
  logger: {
    dir: `${appInfo.baseDir}/logs`,
  },
  uploadDir: `${appInfo.baseDir}/uploads`,
});
