import { getUncachableGitHubClient } from '../server/github-client';
import * as fs from 'fs';
import * as path from 'path';

const REPO_NAME = 'consulting-os-mvp';
const REPO_DESCRIPTION = 'Consulting OS MVP - AI-powered consulting workflow with sequential agents';

const IGNORE_PATTERNS = [
  'node_modules',
  '.git',
  'dist',
  '.cache',
  '.replit',
  'replit.nix',
  '.config',
  '.local',
  '.upm',
  'generated-icon.png',
  'scripts/push-to-github.ts',
  '.breakpoints',
  'tsconfig.tsbuildinfo',
];

function shouldIgnore(filePath: string): boolean {
  return IGNORE_PATTERNS.some(pattern => {
    const normalized = filePath.replace(/^\.\//, '');
    return normalized === pattern || normalized.startsWith(pattern + '/');
  });
}

function getAllFiles(dir: string, base: string = ''): { path: string; content: string }[] {
  const results: { path: string; content: string }[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const relativePath = base ? `${base}/${entry.name}` : entry.name;
    
    if (shouldIgnore(relativePath)) continue;
    
    const fullPath = path.join(dir, entry.name);
    
    if (entry.isDirectory()) {
      results.push(...getAllFiles(fullPath, relativePath));
    } else if (entry.isFile()) {
      try {
        const content = fs.readFileSync(fullPath);
        const isBinary = content.includes(0);
        if (!isBinary) {
          results.push({ path: relativePath, content: content.toString('base64') });
        }
      } catch (e) {
        // skip unreadable files
      }
    }
  }
  
  return results;
}

async function main() {
  console.log('Connecting to GitHub...');
  const octokit = await getUncachableGitHubClient();
  
  const { data: user } = await octokit.users.getAuthenticated();
  console.log(`Authenticated as: ${user.login}`);
  
  let repo;
  try {
    const { data } = await octokit.repos.get({ owner: user.login, repo: REPO_NAME });
    repo = data;
    console.log(`Repository "${REPO_NAME}" already exists.`);
  } catch (e: any) {
    if (e.status === 404) {
      console.log(`Creating repository "${REPO_NAME}"...`);
      const { data } = await octokit.repos.createForAuthenticatedUser({
        name: REPO_NAME,
        description: REPO_DESCRIPTION,
        private: false,
        auto_init: false,
      });
      repo = data;
      console.log(`Repository created: ${repo.html_url}`);
    } else {
      throw e;
    }
  }
  
  console.log('Collecting project files...');
  const files = getAllFiles('.');
  console.log(`Found ${files.length} files to upload.`);
  
  const tree = files.map(f => ({
    path: f.path,
    mode: '100644' as const,
    type: 'blob' as const,
    content: Buffer.from(f.content, 'base64').toString('utf-8'),
  }));

  let isEmptyRepo = false;
  let parentSha: string | undefined;
  try {
    const { data: ref } = await octokit.git.getRef({
      owner: user.login,
      repo: REPO_NAME,
      ref: 'heads/main',
    });
    parentSha = ref.object.sha;
  } catch (e) {
    isEmptyRepo = true;
  }

  if (isEmptyRepo) {
    console.log('Initializing empty repository with README...');
    await octokit.repos.createOrUpdateFileContents({
      owner: user.login,
      repo: REPO_NAME,
      path: 'README.md',
      message: 'Initial commit',
      content: Buffer.from('# Consulting OS MVP\n').toString('base64'),
    });
    const { data: ref } = await octokit.git.getRef({
      owner: user.login,
      repo: REPO_NAME,
      ref: 'heads/main',
    });
    parentSha = ref.object.sha;
  }

  console.log('Creating git tree...');
  const BATCH_SIZE = 50;
  let treeItems: Array<{ path: string; mode: '100644'; type: 'blob'; sha: string }> = [];

  for (let i = 0; i < tree.length; i += BATCH_SIZE) {
    const batch = tree.slice(i, i + BATCH_SIZE);
    console.log(`  Processing files ${i + 1}-${Math.min(i + BATCH_SIZE, tree.length)}...`);
    
    for (const file of batch) {
      const { data } = await octokit.git.createBlob({
        owner: user.login,
        repo: REPO_NAME,
        content: Buffer.from(file.content).toString('base64'),
        encoding: 'base64',
      });
      treeItems.push({ path: file.path, mode: '100644' as const, type: 'blob' as const, sha: data.sha });
    }
  }

  const { data: gitTree } = await octokit.git.createTree({
    owner: user.login,
    repo: REPO_NAME,
    tree: treeItems,
  });

  console.log('Creating commit...');
  const { data: commit } = await octokit.git.createCommit({
    owner: user.login,
    repo: REPO_NAME,
    message: 'Consulting OS MVP - full project upload',
    tree: gitTree.sha,
    parents: parentSha ? [parentSha] : [],
  });
  
  await octokit.git.updateRef({
    owner: user.login,
    repo: REPO_NAME,
    ref: 'heads/main',
    sha: commit.sha,
    force: true,
  });
  
  console.log(`\nDone! Your project has been uploaded to GitHub:`);
  console.log(`  ${repo.html_url}`);
}

main().catch((err) => {
  console.error('Error:', err.message || err);
  process.exit(1);
});
