'use strict';

const fs = require('mz/fs');
const path = require('path');
const sendToWormhole = require('stream-wormhole');
const mkdirp = require('mkdirp');
const Adm = require('adm-zip');
const rimraf = require('rimraf');

fs.mkdirp = dir =>
  new Promise((r, j) => mkdirp(dir, err => (err ? j(err) : r())));
fs.rimraf = dir =>
  new Promise((r, j) => rimraf(dir, err => (err ? j(err) : r())));

function saveStream(stream, filepath) {
  return new Promise((resolve, reject) => {
    if (filepath.indexOf('/read-error-') > 0) {
      stream.once('readable', () => {
        const buf = stream.read(10240);
        console.log('read %d bytes', buf.length);
        setTimeout(() => {
          reject(new Error('mock read error'));
        }, 1000);
      });
    } else {
      try {
        const ws = fs.createWriteStream(filepath);
        ws.on('finish', () => resolve());
        ws.on('error', err => reject(err));
        stream.pipe(ws);
      } catch (err) {
        reject(err);
      }
    }
  });
}

module.exports = app =>
  class UploadController extends app.Controller {
    /**
     * hello world
     */
    * upload() {
      let stream;
      try {
        stream = yield this.ctx.getFileStream();
      } catch (err) {
        this.logger.error('ctx.getFileStream failed, err:', err);
        this.ctx.status = 500;
        this.ctx.body = `parse request stream failed, err: ${err.message}`;
        return;
      }
      const { to, type = 'file' } = stream.fields;
      const dest = path.normalize(decodeURIComponent(to));
      const filename = decodeURIComponent(stream.filename);
      if (!dest || !dest.startsWith(this.config.secPath)) {
        this.logger.error(
          `Form field 'to'=[${dest}] is not valid while upload file: ${filename}`
        );
        this.ctx.status = 400;
        this.ctx.body = 'Form field `to` is not valid! ';
        return;
      }
      type === 'zip'
        ? yield this.handleZipFile(filename, stream, dest)
        : yield this.handleSingleFile(filename, stream, dest);
    }

    * handleZipFile(filename, stream, dest) {
      this.logger.info(`Handling zipfile  [${filename}] to [${dest}]`);

      // 必须先将zip文件保存到临时目录再执行删除旧文件的操作, 因为保存这一步可能失败, 导致旧文件被删除了
      const srcPath = path.resolve(this.config.uploadDir, filename);
      this.logger.info('Saving zipfile [%s] to [%s]', filename, srcPath);
      try {
        yield fs.rimraf(srcPath);
        yield saveStream(stream, srcPath);
        this.logger.info(`Succeed save zip stream [${filename}] succeed`);
        yield sendToWormhole(stream);
      } catch (err) {
        this.loger.error(
          `Failed save zip stream [${filename}] failed, err: `,
          err.message
        );
        yield sendToWormhole(stream);
        this.ctx.status = 500;
        this.ctx.body = `Save stream to zipfile failed, err: ${err.message}`;
        return;
      }

      try {
        const stats = yield fs.stat(dest);
        if (stats.isFile()) {
          this.ctx.status = 400;
          this.ctx.body = `upload zipfile dest must be a directory, but current is file [${dest}]`;
          return;
        }
        // yield fs.rimraf(dest); 不能删除文件夹, 因为zip方式上传只打包了修改后的文件
      } catch (err) {
        // 文件夹不存在
        yield fs.mkdirp(dest);
      }

      try {
        const zip = new Adm(srcPath);
        zip.extractAllTo(dest, true);
        this.logger.info(`Succeed unzip [${filename}] to [${dest}]`);
        yield fs.unlink(srcPath);
        this.ctx.body = '0';
      } catch (err) {
        this.logger.error(
          `Invoke AdmZip to unzip [${filename}] err: `,
          err.message
        );
        yield fs.unlink(srcPath);
        this.ctx.status = 500;
        this.ctx.body = `Unzip zipfile to dest folder failed, err: ${err.message}`;
      }
    }

    * handleSingleFile(filename, stream, dest) {
      this.logger.info(`Handling file [${filename}] to [${dest}]`);
      try {
        const stats = yield fs.stat(dest);
        if (stats.isDirectory()) {
          this.ctx.status = 400;
          this.ctx.body = `upload file dest must be a pathname, but current is directory [${dest}]`;
          return;
        }
        yield fs.unlink(dest);
      } catch (err) {
        // 文件不存在, 文件夹也可能不存在
        yield fs.mkdirp(path.dirname(dest));
      }
      try {
        yield saveStream(stream, dest);
        this.logger.info(`Succeed save file [${filename}] to [${dest}]!`);
        this.ctx.body = '0';
      } catch (err) {
        this.logger.error('Save stream to dest failed, err: ', err);
        this.ctx.status = 500;
        this.ctx.body = `Save stream to dest failed, err: ${err.message}`;
        yield sendToWormhole(stream);
      }
    }

    * form() {
      this.ctx.body = `<form method="post" enctype="multipart/form-data" action="/upload?_csrf=${this
        .csrf}">
    <p>Title: <input type="text" name="title" /></p>
    <p>Image: <input type="file" name="image" /></p>
    <p><input type="submit" value="Upload" /></p>
    </form>`;
    }
  };
