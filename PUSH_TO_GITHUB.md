# 🚀 Guide: How to Successfully Push to GitHub

If you encountered errors while pushing to GitHub (such as `Authentication failed`, `Support for password authentication was removed`, or `Updates were rejected because the remote contains work that you do not have`), follow these steps:

## 1. Ensure Git is Initialized & Committed
Your local project is already initialized as a Git repository and committed on the `main` branch. You can verify this with:
```bash
git status
```

## 2. Set Your GitHub Remote Repository
Link your local repository to your GitHub repository URL (replace with your actual GitHub repo URL):
```bash
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPOSITORY_NAME.git
```
*(If you already added a remote and need to update it: `git remote set-url origin <URL>`)*

## 3. Authenticate with GitHub (Important)
GitHub **does not accept account passwords** when pushing via HTTPS. You must use a **Personal Access Token (PAT)** or GitHub CLI:

### Option A: Personal Access Token (PAT)
1. Go to your GitHub account -> **Settings** -> **Developer Settings** -> **Personal Access tokens** -> **Tokens (classic)** (or Fine-grained tokens).
2. Generate a new token with `repo` scope permissions.
3. When running `git push`, use your GitHub username and paste your **Personal Access Token** as your password.

### Option B: GitHub CLI (`gh`)
If logged in via GitHub CLI in your terminal:
```bash
gh auth login
```

## 4. Push to GitHub
Push your code to the `main` branch and set upstream tracking:
```bash
git branch -M main
git push -u origin main
```
