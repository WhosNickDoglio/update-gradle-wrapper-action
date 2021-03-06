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

import {HttpClient} from '@actions/http-client';

export interface Release {
  version: string;
  allChecksum: string;
  binChecksum: string;
  wrapperChecksum: string;
}

interface ReleaseData {
  version: string;
  buildTime: string;
  current: boolean;
  snapshot: boolean;
  nightly: boolean;
  releaseNightly: boolean;
  activeRc: boolean;
  rcFor: string;
  milestoneFor: string;
  broken: boolean;
  downloadUrl: string;
  checksumUrl: string;
  wrapperChecksumUrl: string;
}

const client = new HttpClient('Update Gradle Wrapper Action');

export async function latest(): Promise<Release> {
  const response = await client.getJson<ReleaseData>(
    // TODO: with 404 result is null, 500 throws
    'https://services.gradle.org/versions/current'
  );
  core.debug(`statusCode: ${response.statusCode}`);

  const data = response.result;

  if (data) {
    core.debug(`current?: ${data.current}`);

    const version = data.version;
    core.debug(`version ${version}`);

    core.debug(`checksumUrl: ${data.checksumUrl}`);
    const distBinChecksum = await fetch(data.checksumUrl);
    core.debug(`distBinChecksum ${distBinChecksum}`);

    const distAllChecksumUrl = data.checksumUrl.replace('-bin.zip', '-all.zip');
    core.debug(`computed distAllChecksumUrl: ${distAllChecksumUrl}`);
    const distAllChecksum = await fetch(distAllChecksumUrl);
    core.debug(`computed distAllChecksum ${distAllChecksum}`);

    core.debug(`wrapperChecksumUrl: ${data.wrapperChecksumUrl}`);
    const wrapperChecksum = await fetch(data.wrapperChecksumUrl);
    core.debug(`wrapperChecksum ${wrapperChecksum}`);

    return {
      version,
      allChecksum: distAllChecksum,
      binChecksum: distBinChecksum,
      wrapperChecksum
    };
  }

  throw new Error('Unable to fetch release data');
}

async function fetch(url: string): Promise<string> {
  const response = await client.get(url);
  core.debug(`statusCode: ${response.message.statusCode}`);

  const body = await response.readBody();
  core.debug(`body: ${body}`);

  return body;
}
