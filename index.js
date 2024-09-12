'use strict';
const http = require('node:http');
const auth = require('http-auth');
const router = require('./lib/router');

const basic = auth.basic({
  realm: 'Enter username and password.',
  file: './.htpasswd',
  algorithm: 'MD5'
});

const server = http.createServer(basic.check((req, res) => {
    router.route(req, res);
  }))
  .on('error', e => {
    console.error('Server Error', e);
  })
  .on('clientError', e => {
    console.error('Client Error', e);
  });

const port = 8000;
server.listen(port, () => {
  console.info(`Listening on ${port}`);
});
