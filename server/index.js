const http  = require('http');
const url   = require('url');
const axios = require('axios');

const port = process.env.PORT || 80;
const org_name = 'Teddy-Hackers'

function github_api_get(url, token, callback) {
  axios.get(url, {
    headers: {
      'Authorization': 'token ' + token,
      'Accept': 'application/vnd.github.antiope-preview+json'  // for /check-suites
    }
  })
  .then((res) => {
    var data = res.data;

    if (res.headers.link) {
      var next_page = undefined;
      res.headers.link.split(', ').forEach((link) => {
        if (link.endsWith('rel="next"')) {
          url = link.substr(1, link.indexOf('>') - 1);
          next_page = url;
        }
      });
      if (next_page) {
        github_api_get(next_page, token, (page_data) => {
          data = data.concat(page_data)
          callback(data);
        });
      } else {
        callback(data);  // This is last page
      }
    } else {
      callback(data);  // Data is represented as a single page
    }
  }).catch((err) => {
    console.error(err);
  });
}

function getName(token, callback) {
  github_api_get('https://api.github.com/user', token, (data) => {
    callback(data.login);
  });
}

function getStatus(pull, token, callback) {
  var url = pull.head.repo.url + '/commits/' + pull.head.sha + '/check-suites';
  github_api_get(url, token, (data) => {
    var status = 'neutral';
    if (data.check_suites.length > 0) {
      status = data.check_suites[0].conclusion;
    }
    callback(status);
  });
}

function listPulls(token, repo, user, callback) {
  axios.get('https://api.github.com/repos/' + user + '/' + repo + '/pulls', {
    params: {
      sort: 'created'
    },
    headers: {
      'Authorization': 'token ' + token
    }
  })
  .then((res) => {
    var out = [];
    var pulls = res.data;
    if (pulls.length == 0) {
      callback(out);
      return;
    }

    var num = 0;
    function inc() {
      num += 1;
      if (num == pulls.length) {
        callback(out);
      }
    }

    pulls.forEach((pull, i) => {
      var pull_data = {};
      pull_data.html_url = pull.html_url;
      out.push(undefined)
      getStatus(pull, token, (data) => {
        pull_data.status = data;
        out[i] = pull_data;
        inc();
      });
    });
  }).catch((err) => {
    console.error(err);
  });
}

function listRepos(token, user_name, callback) {
  github_api_get('https://api.github.com/user/repos?per_page=100', token, (data) => {
    var repos = {};

    var num = 0;
    function inc() {
      num += 1;
      if (num == data.length) {
        callback(repos);
      }
    }

    data.forEach((repo) => {
      var name = repo.full_name;
      if (repo.fork) {
        github_api_get('https://api.github.com/repos/' + repo.full_name, token, (data) => {
          if (data.parent.owner.login.localeCompare(org_name) == 0) {
            listPulls(token, repo.name, user_name, (pulls) => {
              repos[repo.name] = pulls;
              inc();
            });
          } else {
            inc();
          }
        });
      } else {
        inc();
      }
    })
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
      listRepos(token_data.query.access_token, name, (repos) => {
        responseData.name = name;
        responseData.repos = repos;
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.end(JSON.stringify(responseData));
      });
    });
  }).catch((err) => {
    console.error(err);
  });
}).listen(port);
