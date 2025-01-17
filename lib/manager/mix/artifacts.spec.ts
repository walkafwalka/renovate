import { join } from 'upath';
import { envMock, exec, mockExecAll } from '../../../test/exec-util';
import { env, fs, getName } from '../../../test/util';
import { setAdminConfig } from '../../config/admin';
import type { RepoAdminConfig } from '../../config/types';
import { setExecConfig } from '../../util/exec';
import { BinarySource } from '../../util/exec/common';
import * as docker from '../../util/exec/docker';
import type { UpdateArtifactsConfig } from '../types';
import { updateArtifacts } from '.';

jest.mock('child_process');
jest.mock('../../util/exec/env');
jest.mock('../../util/fs');

const adminConfig: RepoAdminConfig = {
  // `join` fixes Windows CI
  localDir: join('/tmp/github/some/repo'),
};

const config: UpdateArtifactsConfig = {};

describe(getName(), () => {
  beforeEach(async () => {
    jest.resetAllMocks();
    jest.resetModules();

    env.getChildProcessEnv.mockReturnValue(envMock.basic);
    await setExecConfig(adminConfig as never);
    setAdminConfig(adminConfig);
  });

  afterEach(() => {
    setAdminConfig();
  });

  it('returns null if no mix.lock found', async () => {
    expect(
      await updateArtifacts({
        packageFileName: 'mix.exs',
        updatedDeps: ['plug'],
        newPackageFileContent: '',
        config,
      })
    ).toBeNull();
  });

  it('returns null if no updatedDeps were provided', async () => {
    expect(
      await updateArtifacts({
        packageFileName: 'mix.exs',
        updatedDeps: [],
        newPackageFileContent: '',
        config,
      })
    ).toBeNull();
  });

  it('returns null if updatedDeps is empty', async () => {
    expect(
      await updateArtifacts({
        packageFileName: 'mix.exs',
        updatedDeps: ['plug'],
        newPackageFileContent: '',
        config,
      })
    ).toBeNull();
  });

  it('returns null if unchanged', async () => {
    fs.readLocalFile.mockResolvedValueOnce('Current mix.lock');
    const execSnapshots = mockExecAll(exec);
    fs.readLocalFile.mockResolvedValueOnce('Current mix.lock');
    expect(
      await updateArtifacts({
        packageFileName: 'mix.exs',
        updatedDeps: ['plug'],
        newPackageFileContent: '',
        config,
      })
    ).toBeNull();
    expect(execSnapshots).toMatchSnapshot();
  });

  it('returns updated mix.lock', async () => {
    jest.spyOn(docker, 'removeDanglingContainers').mockResolvedValueOnce();
    await setExecConfig({ ...adminConfig, binarySource: BinarySource.Docker });
    fs.readLocalFile.mockResolvedValueOnce('Old mix.lock');
    const execSnapshots = mockExecAll(exec);
    fs.readLocalFile.mockResolvedValueOnce('New mix.lock');
    expect(
      await updateArtifacts({
        packageFileName: 'mix.exs',
        updatedDeps: ['plug'],
        newPackageFileContent: '{}',
        config,
      })
    ).toMatchSnapshot();
    expect(execSnapshots).toMatchSnapshot();
  });

  it('catches write errors', async () => {
    fs.readLocalFile.mockResolvedValueOnce('Current mix.lock');
    fs.writeLocalFile.mockImplementationOnce(() => {
      throw new Error('not found');
    });
    expect(
      await updateArtifacts({
        packageFileName: 'mix.exs',
        updatedDeps: ['plug'],
        newPackageFileContent: '{}',
        config,
      })
    ).toMatchSnapshot();
  });

  it('catches exec errors', async () => {
    fs.readLocalFile.mockResolvedValueOnce('Current mix.lock');
    exec.mockImplementationOnce(() => {
      throw new Error('exec-error');
    });
    expect(
      await updateArtifacts({
        packageFileName: 'mix.exs',
        updatedDeps: ['plug'],
        newPackageFileContent: '{}',
        config,
      })
    ).toMatchSnapshot();
  });
});
