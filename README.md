
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

Every project which is listed on dashboard should be added as submodule:

```bash
cd projects
git submodule add -b master <url to repository>
```

**NOTE**: thanks to `-b` option the latest state of submodule's branch is used.

To update local version of submodule, use

```bash
git submodule update --remote
```
