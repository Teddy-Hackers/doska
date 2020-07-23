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
    callback(res.data);
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
    callback(data.check_suites[0].conclusion);
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

    function next(i, callback) {
      var pull_data = {};
      pull_data.html_url = pulls[i].html_url;
      getStatus(pulls[i], token, (data) => {
        pull_data.status = data;
        out.push(pull_data);

        if (i < pulls.length - 1) {
          next(i + 1, callback);
        } else {
          callback(out);
        }
      });
    }
    next(0, callback);
  }).catch((err) => {
    console.error(err);
  });
}

function listRepos(token, user_name, callback) {
  github_api_get('https://api.github.com/user/repos', token, (data) => {
    data.forEach((repo) => {
      var name = repo.full_name;
      github_api_get('https://api.github.com/repos/' + repo.full_name, token, (data) => {
        if (data.parent && data.parent.owner.login.localeCompare(org_name) == 0) {
          listPulls(token, repo.name, user_name, (pulls) => {
            var repos = {};
            repos[repo.name] = pulls
            callback(repos);
          });
        }
      });
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
        console.log(name);
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
