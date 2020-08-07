const http  = require('http');
const url   = require('url');
const axios = require('axios');
const fs    = require('fs');

const lib    = require('common');

const port = process.env.PORT || 80;
const org_name = 'Teddy-Hackers'

let repos_whitelist = Object.keys(JSON.parse(fs.readFileSync('server/common/package.json')).dependencies);

function getName(token, callback) {
  lib.github_api_get('https://api.github.com/user', token, (data) => {
    callback(data.login);
  });
}

function getStatus(pull, token, callback) {
  var url = pull.head.repo.url + '/commits/' + pull.head.sha + '/check-suites';
  lib.github_api_get(url, token, (data) => {
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
  var repos = {};

  var num = 0;
  function inc() {
    num += 1;
    if (num == repos_whitelist.length) {
      callback(repos);
    }
  }

  repos_whitelist.forEach(project => {
    var project_lib = require(project);
    project_lib.check(user_name, token, (tasks) => {
      repos[project] = tasks;
      inc();
    });
  });
}

function listReposAdmin(token, callback) {
  // TODO: multiple repositories
  repos_whitelist.forEach((repo) => {
    var project_lib = require(repo);
    lib.github_api_get('https://api.github.com/repos/' + org_name + '/' + repo + '/forks', token, (forks) => {
      if (forks.length == 0) {
        callback(repos);
        return;
      }

      var repos = {};
      repos[repo] = {};
      var num = 0;
      forks.forEach((fork) => {
        project_lib.check(fork.owner.login, token, (tasks) => {
          repos[repo][fork.owner.login] = tasks;
          num += 1;
          if (num == forks.length) {
            callback(repos);
          }
        });
      });
    }, (err) => {/*ignore missed repos*/});
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

  res.setHeader('Access-Control-Allow-Origin', '*');

  axios.post('https://github.com/login/oauth/access_token', data)
  .then((oauth_res) => {
    var token_data = url.parse('?' + oauth_res.data, /*parseQueryString*/ true);
    getName(token_data.query.access_token, (name) => {
      var token = token_data.query.access_token;

      responseData.name = name;

      // Check user membership for an organization
      lib.github_api_get('https://api.github.com/orgs/' + org_name + '/members/' + name, token,
        // User is inside the organization
        () => {
          listReposAdmin(token, (repos) => {
            responseData.view = 'admin';
            responseData.repos = repos;
            res.end(JSON.stringify(responseData));
          });
        },

        // User is outside the organization
        () => {
          listRepos(token, name, (repos) => {
            responseData.view = 'student';
            responseData.repos = repos;
            res.end(JSON.stringify(responseData));
          });
        }
      );
    });
  }).catch((err) => {
    console.error(err);
  });
}).listen(port);
