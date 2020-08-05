
## Developers guide

To run server locally:

```bash
sudo apt-get install -y nodejs npm
npm install axios
```

then

```bash
export PORT=56582
export GITHUB_CLIENT_ID=client_id
export GITHUB_CLIENT_SECRET=client_secret
node server
```

### Add new projects to track

To start project tracking, you need to add it to `server/common/package.json` file into `dependencies` section:

```json
"practice_git": "https://github.com/Teddy-Hackers/practice_git"
```
