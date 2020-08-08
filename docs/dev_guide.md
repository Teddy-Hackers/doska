# Teddyvelopers guide

There are two parts of the dashboard - frontend client and backend server.
Client performs GitHub Authentification and then requests student's projects
progress from a server. Server performs GitHub API requests to collect the progress.

### Client development
If you want to experiment with frontend client part - it's enough to host a site
locally:

```bash
cd doska
python3 -m http.server
```

### Server development

If you wanted to modify server components, install the dependencies

```bash
sudo apt-get install -y nodejs npm

cd doska
npm install
```

then start a server by:

```bash
export PORT=56582
export GITHUB_CLIENT_ID=client_id
export GITHUB_CLIENT_SECRET=client_secret
node server
```

### Create a new project

To start project tracking, you need to add it to `server/common/package.json` file into `dependencies` section:

```json
"practice_git": "https://github.com/Teddy-Hackers/practice_git"
```
