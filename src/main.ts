import * as core from '@actions/core';
import { Client } from './client';

async function run(): Promise<void> {
  try {
    let status: string = core.getInput('status', { required: true });
    status = status.toLowerCase();
    const author_name = core.getInput('author_name');
    const text = core.getInput('text');
    const runId = core.getInput('runId');

    core.debug(`status: ${status}`);
    core.debug(`author_name: ${author_name}`);
    core.debug(`text: ${text}`);
    core.debug(`runId: ${runId}`);

    const client = new Client(
      {
        text,
        status,
        author_name,
        runId,
      },
      process.env.GITHUB_TOKEN,
      process.env.SLACK_WEBHOOK_URL,
    );

    switch (status) {
      case 'success':
        await client.send(await client.success(text));
        break;
      case 'failure':
        await client.send(await client.fail(text));
        break;
      case 'cancelled':
        await client.send(await client.cancel(text));
        break;
      default:
        throw new Error(
          'You can specify success or failure or cancelled or custom',
        );
    }
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
