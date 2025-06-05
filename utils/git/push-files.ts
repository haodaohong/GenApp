import { Octokit } from "@octokit/rest";

/**
 * Pushes multiple files to a GitHub repository
 * @param options Options for pushing files
 * @returns Result of the operation
 */
export async function pushFiles({
  token,
  owner,
  repo,
  branch = "main",
  message,
  files,
  committer = {
    name: "wordixai",
    email: "wordixai@gmail.com",
  },
}: {
  token: string;
  owner: string;
  repo: string;
  branch?: string;
  message: string;
  files: Array<{
    path: string;
    content: string;
  }>;
  committer?: {
    name: string;
    email: string;
  };
}) {
  const octokit = new Octokit({ auth: token });

  try {
    // Get the reference to the branch
    const reference = await octokit.git.getRef({
      owner,
      repo,
      ref: `heads/${branch}`,
    });

    // Get the commit that the branch points to
    const commit = await octokit.git.getCommit({
      owner,
      repo,
      commit_sha: reference.data.object.sha,
    });

    // Create blobs for each file
    const fileBlobs = await Promise.all(
      files.map(async (file) => {
        const blob = await octokit.git.createBlob({
          owner,
          repo,
          content: Buffer.from(file.content).toString("base64"),
          encoding: "base64",
        });

        // Remove leading slash and 'app/' prefix from file path
        const normalizedPath = file.path
          .replace(/^\//, '')  // Remove leading slash
          .replace(/^app\//, '');  // Remove 'app/' prefix

        return {
          path: normalizedPath,
          mode: "100644" as const,
          type: "blob" as const,
          sha: blob.data.sha,
        };
      })
    );

    // Create a tree with the new blobs
    const tree = await octokit.git.createTree({
      owner,
      repo,
      base_tree: commit.data.tree.sha,
      tree: fileBlobs,
    });

    // Create a new commit
    const newCommit = await octokit.git.createCommit({
      owner,
      repo,
      message,
      tree: tree.data.sha,
      parents: [commit.data.sha],
      committer,
    });

    // Update the reference to point to the new commit
    await octokit.git.updateRef({
      owner,
      repo,
      ref: `heads/${branch}`,
      sha: newCommit.data.sha,
    });

    return {
      success: true,
      commitSha: newCommit.data.sha,
    };
  } catch (error) {
    console.error("Error pushing files to GitHub:", error);
    return {
      success: false,
      error,
    };
  }
}
