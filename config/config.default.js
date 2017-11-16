'use strict';

const fs = require('fs');
const path = require('path');

module.exports = appInfo => {
  const config = (exports = {});

  config.secPath = 'C:/byd/publish';

  config.siteFile = {
    '/favicon.ico': fs.readFileSync(
      path.join(appInfo.baseDir, 'app/public/favicon.ico')
    ),
  };


  config.security = {
    xframe: {
      enable: false,
    },
    csp: false,
    csrf: {
      enable: false,
      ignore: () => true,
    },
  };

  config.multipart = {
    fileSize: '250mb',
    whitelist: () => true,
    fileExtensions: [
      '.scss',
      '.svg',
      '.ttf',
      '.otf',
      '.eot',
      '.woff',
      '.woff2',
      '.zip',
      '.md',
      '.map',
      '.css.map',
      '.js.map',
      '.doc',
      '.docx',
      '.txt',
      '.DS_Store',
      '.html',
    ],
  };

  return config;
};
