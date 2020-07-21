const http  = require('http');
const url   = require('url');
const axios = require('axios');

const port = process.env.PORT || 80;

function getName(token, callback) {
  axios.get('https://api.github.com/user', {
    headers: {
      'Authorization': 'token ' + token
    }
  })
  .then((res) => {
    callback(res.data.login);
  }).catch((err) => {
    console.error(err);
  });
}

http.createServer(function (req, res) {
  var requestData = url.parse(req.url, /*parseQueryString*/ true);

  var responseData = {
    status: 200,  // OK
    error: null
  };

  // Get GitHub token for a user
  const data = {
    client_id: process.env.GITHUB_CLIENT_ID,
    client_secret: process.env.GITHUB_CLIENT_SECRET,
    code: requestData.query.code
  };

  axios.post('https://github.com/login/oauth/access_token', data)
  .then((oauth_res) => {
    var token_data = url.parse('?' + oauth_res.data, /*parseQueryString*/ true);
    getName(token_data.query.access_token, (name) => {
      responseData.name = name;
      console.log(name);
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.end(JSON.stringify(responseData));
    });
  }).catch((err) => {
    console.error(err);
  });
}).listen(port);
