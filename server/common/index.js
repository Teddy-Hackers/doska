const axios = require('axios');

module.exports.github_api_get = function github_api_get(url, token, callback, err_callback) {
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
    if (err_callback) {
      err_callback(err)
    } else {
      console.error(err);
    }
  });
}
