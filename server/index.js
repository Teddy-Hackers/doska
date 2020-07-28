const http  = require('http');
const url   = require('url');
const axios = require('axios');
const fs    = require('fs');

const port = process.env.PORT || 80;
const org_name = 'Teddy-Hackers'

let repos_whitelist = JSON.parse(fs.readFileSync('server/repos_whitelist.json'));

function is_project_repo(repo) {
  for (var i = 0; i < repos_whitelist.length; i += 1) {
    if (repos_whitelist[i].localeCompare(repo) == 0) {
      return true;
    }
  }
  return false;
}

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

function listReposAdmin(token, callback) {
  github_api_get('https://api.github.com/orgs/' + org_name + '/repos?per_page=100', token, (data) => {
    var repos = {};
    data.forEach((repo) => {
      var name = repo.full_name;
      if (is_project_repo(repo.name)) {
        github_api_get(repo.forks_url, token, (forks) => {

          var num = 0;
          forks.forEach((fork) => {
            listPulls(token, repo.name, fork.owner.login, (pulls) => {
              repos[fork.owner.login] = pulls;
              num += 1;
              if (num == forks.length) {
                callback(repos);
              }
            });
          });

        });
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

  res.setHeader('Access-Control-Allow-Origin', '*');

  axios.post('https://github.com/login/oauth/access_token', data)
  .then((oauth_res) => {
    var token_data = url.parse('?' + oauth_res.data, /*parseQueryString*/ true);
    getName(token_data.query.access_token, (name) => {
      var token = token_data.query.access_token;

      responseData.name = name;

      // Check user membership for an organization
      axios.get('https://api.github.com/orgs/' + org_name + '/members/' + name, {
        headers: {
          'Authorization': 'token ' + token,
        }
      }).then(() => {
        // User is inside the organization
        listReposAdmin(token, (repos) => {
          responseData.repos = repos;
          res.end(JSON.stringify(responseData));
        });
      }).catch(() => {
        // User is outside the organization
        listRepos(token, name, (repos) => {
          responseData.repos = repos;
          res.end(JSON.stringify(responseData));
        });
      });
    });
  }).catch((err) => {
    console.error(err);
  });
}).listen(port);
