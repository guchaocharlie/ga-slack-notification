import * as core from '@actions/core';
import * as github from '@actions/github';
import { IncomingWebhook, IncomingWebhookSendArguments } from '@slack/webhook';

export interface With {
  status: string;
  mention: string;
  author_name: string;
  only_mention_fail: string;
  username: string;
  icon_emoji: string;
  icon_url: string;
  channel: string;
}

const groupMention = ['here', 'channel'];

export class Client {
  private webhook: IncomingWebhook;
  private github?: github.GitHub;
  private with: With;

  constructor(props: With, token?: string, webhookUrl?: string) {
    this.with = props;

    if (props.status !== 'custom') {
      if (token === undefined) {
        throw new Error('Specify secrets.GITHUB_TOKEN');
      }
      this.github = new github.GitHub(token);
    }

    if (webhookUrl === undefined) {
      throw new Error('Specify secrets.SLACK_WEBHOOK_URL');
    }
    this.webhook = new IncomingWebhook(webhookUrl);
  }

  async getData() {
    if (this.github === undefined) {
      throw Error('Specify secrets.GITHUB_TOKEN');
    }
    const { sha } = github.context;
    const { owner, repo } = github.context.repo;
    const commit = await this.github.repos.getCommit({ owner, repo, sha });
    const { author } = commit.data.commit;
    return {
      commit,
      sha,
      owner,
      repo,
      author,
    };
  }

  async success(text: string) {
    const gitData = await this.getData();
    const template = await this.payloadTemplate();
    template.attachments[0].color = 'good';
    template.text += `:white_check_mark: Succeeded GitHub Actions by ${gitData.author.name}, good work! \n`;
    template.text += text;

    return template;
  }

  async fail(text: string) {
    const gitData = await this.getData();
    const template = await this.payloadTemplate();
    template.attachments[0].color = 'danger';
    template.text += this.mentionText(this.with.only_mention_fail);
    template.text += `:no_entry: Failed GitHub Actions by ${gitData.author.name}, please fix me!\n `;
    template.text += text;

    return template;
  }

  async cancel(text: string) {
    const gitData = await this.getData();
    const template = await this.payloadTemplate();
    template.attachments[0].color = 'warning';
    template.text += `:warning: Canceled GitHub Actions\n by ${gitData.author.name}, please try again! `;
    template.text += text;

    return template;
  }

  async send(payload: string | IncomingWebhookSendArguments) {
    core.debug(JSON.stringify(github.context, null, 2));
    await this.webhook.send(payload);
    core.debug('send message');
  }

  private async payloadTemplate() {
    const text = this.mentionText(this.with.mention);
    const { username, icon_emoji, icon_url, channel } = this.with;

    return {
      text,
      username,
      icon_emoji,
      icon_url,
      channel,
      attachments: [
        {
          color: '',
          author_name: this.with.author_name,
          fields: await this.fields(),
        },
      ],
    };
  }

  private async fields() {
    const gitData = await this.getData();

    return [
      this.repo,
      {
        title: 'author',
        value: gitData.author.name,
        short: true,
      },
      this.ref,
      this.workflow,
    ];
  }

  private get commit() {
    const { sha } = github.context;
    const { owner, repo } = github.context.repo;

    return {
      title: 'commit',
      value: `<https://github.com/${owner}/${repo}/commit/${sha}|${sha}>`,
      short: true,
    };
  }

  private get repo() {
    const { owner, repo } = github.context.repo;

    return {
      title: 'repo',
      value: `<https://github.com/${owner}/${repo}|${owner}/${repo}>`,
      short: true,
    };
  }

  private get ref() {
    return { title: 'ref', value: github.context.ref, short: true };
  }

  private get workflow() {
    return { title: 'workflow', value: github.context.workflow, short: true };
  }

  private mentionText(mention: string) {
    const normalized = mention.replace(/ /g, '');
    if (groupMention.includes(normalized)) {
      return `<!${normalized}> `;
    } else if (normalized !== '') {
      const text = normalized
        .split(',')
        .map(userId => `<@${userId}>`)
        .join(' ');
      return `${text} `;
    }
    return '';
  }
}
