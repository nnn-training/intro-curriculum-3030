'use strict';
const pug = require('pug');
const Cookies = require('cookies');
const Post = require('./post');
const util = require('./handler-util');
const currentThemeKey = 'current_theme';

const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
dayjs.extend(utc);
dayjs.extend(timezone);
const crypto = require('crypto');

const oneTimeTokenMap = new Map(); // キーをユーザー名、値をトークンとする連想配列

async function handle(req, res) {
  const cookies = new Cookies(req, res);
  if(!cookies.get(currentThemeKey)) {
    const currentTheme = 'light';
    cookies.set(currentThemeKey,currentTheme);
  }

  switch (req.method) {
    case 'GET':
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8'
      });
      const currentTheme = cookies.get(currentThemeKey);
      const currentBodyClass = cookies.get(currentThemeKey) === 'light' ?
        "container" : "container bg-dark text-white";
      const currentTextClass = cookies.get(currentThemeKey) === 'light' ?
        "form-control":"form-control bg-secondary text-white";
      const posts = await Post.findAll({order:[['id', 'DESC']]});
      posts.forEach((post) => {
        post.formattedCreatedAt = dayjs(post.createdAt).tz('Asia/Tokyo').format('YYYY年MM月DD日 HH時mm分ss秒');
      });
      const oneTimeToken = crypto.randomBytes(8).toString('hex');
      oneTimeTokenMap.set(req.user, oneTimeToken);
      res.end(pug.renderFile('./views/posts.pug', {
        currentBodyClass,
        currentTheme,
        currentTextClass,
        posts, 
        user: req.user,
        oneTimeToken
      }));
      console.info(
        `閲覧されました: user: ${req.user}, ` +
        `remoteAddress: ${req.socket.remoteAddress}, ` +
        `userAgent: ${req.headers['user-agent']} `
      );
      break;
    case 'POST':
      let body = '';
      req.on('data', (chunk) => {
        body += chunk;
      }).on('end', async () => {
        const params = new URLSearchParams(body);
        const content = params.get('content');
        const requestedOneTimeToken = params.get('oneTimeToken');
        if (!(content && requestedOneTimeToken)) {
          util.handleBadRequest(req, res);
        } else {
          if (oneTimeTokenMap.get(req.user) === requestedOneTimeToken) {
            console.info(`送信されました: ${content}`);
            await Post.create({
              content: content,
              postedBy: req.user
            });
            oneTimeTokenMap.delete(req.user);
            handleRedirectPosts(req, res);
          } else {
            util.handleBadRequest(req, res);
          }
        }
      });
      break;
    default:
      util.handleBadRequest(req, res);
      break;
  }
}

async function changeTheme(req, res) {
  const cookies = new Cookies(req, res);
  if (!cookies.get(currentThemeKey) ||
    cookies.get(currentThemeKey) === 'dark') {
    cookies.set(currentThemeKey, 'light');
  } else {
    cookies.set(currentThemeKey, 'dark');
  } 
  handleRedirectPosts(req, res);
}

function handleRedirectPosts(req, res) {
  res.writeHead(303, {
    'Location': '/posts'
  });
  res.end();
}

function handleDelete(req, res) {
  switch (req.method) {
    case 'POST':
      let body = '';
      req.on('data', (chunk) => {
        body += chunk;
      }).on('end', async () => {
        const params = new URLSearchParams(body);
        const id = params.get('id');

        const requestedOneTimeToken = params.get('oneTimeToken');
        if (!(id && requestedOneTimeToken)) {
          util.handleBadRequest(req, res);
        } else {
          if (oneTimeTokenMap.get(req.user) === requestedOneTimeToken) {
            const post = await Post.findByPk(id);
            if (req.user === post.postedBy || req.user === 'admin') {
              await post.destroy();
              console.info(
                `削除されました: user: ${req.user}, ` +
                `remoteAddress: ${req.socket.remoteAddress}, ` +
                `userAgent: ${req.headers['user-agent']} `
              );
              handleRedirectPosts(req, res); 
            } else {
              util.handleBadRequest(req, res);
            }
          }
        }
      });
      break;
    default:
      util.handleBadRequest(req, res);
      break;
  }
}

module.exports = {
  handle,
  changeTheme,
  handleDelete
};