'use strict';

module.exports = appInfo => ({
  debug: true,
  logger: {
    level: 'DEBUG',
    consoleLevel: 'DEBUG',
  },
  uploadDir: `${appInfo.baseDir}/uploads`,
});
