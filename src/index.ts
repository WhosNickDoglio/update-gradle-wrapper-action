// Copyright 2020 Cristian Greco
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import * as core from '@actions/core';
import * as glob from '@actions/glob';

import {getInputs} from './inputs';
import {commit} from './git-commit';
import {WrapperInfo} from './wrapperInfo';
import {WrapperUpdater} from './wrapperUpdater';
import * as gh from './github/gh-ops';
import * as git from './git-cmds';
import * as releases from './releases';

/* eslint-disable-next-line @typescript-eslint/no-non-null-assertion */
const currentCommitSha = process.env.GITHUB_SHA!;

async function run() {
  try {
    if (core.isDebug()) {
      core.debug(JSON.stringify(process.env, null, 2));
    }

    const inputs = getInputs();

    const targetRelease = await releases.latest();
    core.info(`Latest release: ${targetRelease.version}`);

    const githubOps = new gh.GitHubOps(inputs);

    const ref = await githubOps.findMatchingRef(targetRelease.version);

    if (ref) {
      core.info('Found an existing ref, stopping here.');
      core.debug(`Ref url: ${ref.url}`);
      core.debug(`Ref sha: ${ref.object.sha}`);
      core.warning(
        `A pull request already exists that updates Gradle Wrapper to ${targetRelease.version}.`
      );
      return;
    }

    const globber = await glob.create(
      '**/gradle/wrapper/gradle-wrapper.properties',
      {followSymbolicLinks: false}
    );
    const wrappers = await globber.glob();
    core.debug(`Wrappers: ${JSON.stringify(wrappers, null, 2)}`);

    if (!wrappers.length) {
      core.warning('Unable to find Gradle Wrapper files in this project.');
      return;
    }

    core.debug(`Wrappers count: ${wrappers.length}`);

    const wrapperInfos = wrappers.map(path => new WrapperInfo(path));

    const commitDataList: {
      files: string[];
      targetVersion: string;
      sourceVersion: string;
    }[] = [];

    await git.config('user.name', 'gradle-update-robot');
    await git.config('user.email', 'gradle-update-robot@regolo.cc');

    core.startGroup('Creating branch');
    const branchName = `gradlew-update-${targetRelease.version}`;
    await git.checkout(branchName, currentCommitSha);
    core.endGroup();

    for (const wrapper of wrapperInfos) {
      core.startGroup(`Working with Wrapper at: ${wrapper.path}`);

      // read current version before updating the wrapper
      core.debug(`Current Wrapper version: ${wrapper.version}`);

      if (wrapper.version === targetRelease.version) {
        core.info(`Wrapper is already up-to-date`);
        continue;
      }

      const updater = new WrapperUpdater(
        wrapper,
        targetRelease,
        inputs.setDistributionChecksum
      );

      core.startGroup('Updating Wrapper');
      await updater.update();
      core.endGroup();

      core.startGroup('Checking whether any file has been updated');
      const modifiedFiles = await git.gitDiffNameOnly();
      core.debug(`Modified files count: ${modifiedFiles.length}`);
      core.debug(`Modified files list: ${modifiedFiles}`);
      core.endGroup();

      if (modifiedFiles.length) {
        core.startGroup('Verifying Wrapper');
        await updater.verify();
        core.endGroup();

        core.startGroup('Committing');
        await commit(modifiedFiles, targetRelease.version, wrapper.version);
        core.endGroup();

        commitDataList.push({
          files: modifiedFiles,
          targetVersion: targetRelease.version,
          sourceVersion: wrapper.version
        });
      } else {
        core.info(`Nothing to update for Wrapper at ${wrapper.path}`);
      }

      core.endGroup();
    }

    if (!commitDataList.length) {
      core.warning(
        `✅ Gradle Wrapper is already up-to-date (version ${targetRelease.version})! 👍`
      );
      return;
    }

    const changedFilesCount = commitDataList
      .map(cd => cd.files.length)
      .reduce((acc, item) => acc + item);
    core.debug(
      `Have added ${commitDataList.length} commits for a total of ${changedFilesCount} files`
    );

    core.info('Pushing branch');
    await git.push(branchName);

    core.info('Creating Pull Request');
    const pullRequestUrl = await githubOps.createPullRequest(
      branchName,
      targetRelease.version,
      commitDataList.length === 1 ? commitDataList[0].sourceVersion : undefined
    );

    core.info(`✅ Created a Pull Request at ${pullRequestUrl} ✨`);
  } catch (error) {
    // setFailed is fatal (terminates action), core.error
    // creates a failure annotation instead
    core.setFailed(`❌ ${error.message}`);
  }
}

run();
