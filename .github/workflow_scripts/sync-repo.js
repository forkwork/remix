const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

module.exports = async ({ github, context }) => {
  const { owner, repo } = context.repo;

  try {
    const packageJSONPath = path.join(
      __dirname,
      "..",
      "..",
      "packages",
      "remix-dev",
      "package.json"
    );

    let packageJSON = JSON.parse(fs.readFileSync(packageJSONPath, "utf-8"));

    const existingVersion = packageJSON.version;

    await github.rest.repos.mergeUpstream({
      owner,
      repo,
      branch: "main",
    });

    execSync("git pull origin main");

    packageJSON = JSON.parse(fs.readFileSync(packageJSONPath, "utf-8"));

    const newVersion = packageJSON.version;

    if (existingVersion !== newVersion) {
      // Sync the version in the `@khulnasoft/remix` package
      const khulnasoftRemixPackageJSONPath = path.join(
        __dirname,
        "..",
        "..",
        "packages",
        "khulnasoft-remix",
        "package.json"
      );
      const khulnasoftRemixPackageJSON = JSON.parse(
        fs.readFileSync(khulnasoftRemixPackageJSONPath, "utf-8")
      );
      khulnasoftRemixPackageJSON.version =
        khulnasoftRemixPackageJSON.peerDependencies["@remix-run/dev"] =
        khulnasoftRemixPackageJSON.peerDependencies["@remix-run/node"] =
        khulnasoftRemixPackageJSON.peerDependencies["@remix-run/server-runtime"] =
        khulnasoftRemixPackageJSON.devDependencies["@remix-run/dev"] =
        khulnasoftRemixPackageJSON.devDependencies["@remix-run/node"] =
        khulnasoftRemixPackageJSON.devDependencies["@remix-run/server-runtime"] =
          newVersion;
      fs.writeFileSync(
        khulnasoftRemixPackageJSONPath,
        `${JSON.stringify(khulnasoftRemixPackageJSON, null, 2)}\n`
      );

      execSync("pnpm i --no-frozen-lockfile");
      execSync("git config --global user.email infra+release@khulnasoft.com");
      execSync("git config --global user.name khulnasoft-release-bot");
      execSync(
        "git add packages/khulnasoft-remix/package.json pnpm-workspace.yaml pnpm-lock.yaml"
      );
      execSync(`git commit -m "Set version in @khulnasoft/remix to ${newVersion}"`);
      execSync("git push origin main");

      await github.rest.actions.createWorkflowDispatch({
        owner,
        repo,
        workflow_id: "publish.yml",
        ref: "main",
      });
    }
  } catch (err) {
    // Conflict detected
    if (err.status === 409) {
      const commit = await github.rest.repos.getCommit({
        owner: "remix-run",
        repo: "remix",
        ref: "main",
      });
      const title = "Merge Conflict ❌";
      const body = `Latest commit: ${commit.data.html_url}

## How to resolve

Pull from the upstream repo:

\`\`\`
git pull https://github.com/remix-run/remix.git main
\`\`\`

There will be a merge conflict, which needs to be resolved manually.

Frequently, these conflicts are regarding GitHub workflow files,
which were deleted in the \`khulnasoft/remix\` repo. In this case,
those workflow files can be \`git rm\`'d again to resolve.

If there is a conflict within the source code (i.e. in the Remix
compiler) then the conflicts will need to be manually resolved.

Finally, before committing the resolved merge, ensure that the \`version\`
field in the "khulnasoft-remix" package's \`package.json\` file matches that
of the "remix-dev" package. If the version needs to be updated, update
the Remix-related dependencies in the \`package.json\` file as well,
since Remix keeps them in sync.
`;
      const issues = await github.rest.issues.listForRepo({
        owner,
        repo,
      });
      const existingIssue = issues.data.find((issue) => issue.title === title);
      if (existingIssue) {
        if (existingIssue.body !== body) {
          await github.rest.issues.update({
            owner,
            repo,
            issue_number: existingIssue.number,
            body,
          });
        } else {
          console.log(`Latest merge conflict commit did not change.`);
        }
      } else {
        await github.rest.issues.create({
          owner,
          repo,
          title,
          body,
        });
      }
    }

    throw err;
  }
};
