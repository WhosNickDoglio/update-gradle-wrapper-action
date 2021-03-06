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

import * as path from 'path';

import {WrapperInfo} from '../src/wrapperInfo';

test('parses a valid properties file', () => {
  const propsPath = path.resolve('tests/data/gradle-wrapper.properties');

  const wrapperInfo = new WrapperInfo(propsPath);
  expect(wrapperInfo.version).toBe('6.6.1');
  expect(wrapperInfo.distType).toBe('all');
});
